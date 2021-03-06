import mimetypes
from functools import wraps
from io import BytesIO
from uuid import UUID

from flask import Blueprint, current_app, g, jsonify, request, send_file
from sqlalchemy.exc import IntegrityError
from webargs import fields
from werkzeug.exceptions import HTTPException, UnprocessableEntity

from . import paprika
from .args import use_kwargs
from .models import Partner, Recipe, User, db
from .schemas import (
    AllPartnersSchema,
    BasicRecipeSchema,
    CategorySchema,
    PartnerUserSchema,
    PendingPartnersSchema,
    RecipeSchema,
    UserSchema,
)

api = Blueprint('api', __name__, url_prefix='/api')


@api.errorhandler(UnprocessableEntity)
def handle_unprocessableentity(exc):
    data = getattr(exc, 'data', None)
    if data and 'messages' in data:
        # this error came from a webargs parsing failure
        response = jsonify(webargs_errors=data['messages'])
        response.status_code = exc.code
        return response
    if exc.response:
        return exc
    return 'Unprocessable Entity'


@api.errorhandler(HTTPException)
def _handle_http_exception(exc):
    return jsonify(error=exc.description), exc.code


@api.errorhandler(Exception)
def _handle_exception(exc):
    current_app.logger.exception('Request failed')
    return jsonify(error='Internal error'), 500


def require_user(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth = request.headers.get('Authorization')
        token = None
        if auth and auth.startswith('Bearer '):
            token = auth[7:]
        if not token:
            return jsonify(error='token_missing'), 401
        try:
            UUID(token)
        except ValueError:
            return jsonify(error='token_invalid'), 401
        user = User.query.filter_by(token=token).first()
        if not user or token != user.token:
            return jsonify(error='token_invalid'), 401
        g.user = user
        return fn(*args, **kwargs)

    return wrapper


def allow_partner(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            partner_id = kwargs.pop('partner_id')
        except KeyError:
            kwargs['user'] = g.user
        else:
            if not (user := g.user.get_active_partner(partner_id)):
                return jsonify(error='no_such_partner'), 404
            kwargs['user'] = user
        return fn(*args, **kwargs)

    return wrapper


@api.route('/user/login', methods=('POST',))
@use_kwargs(
    {'email': fields.String(required=True), 'password': fields.String(required=True)},
    location='json',
)
def user_login(email, password):
    email = email.lower()
    user = User.query.filter_by(email=email).first()
    if user:
        current_app.logger.info('Found existing user for %s', email)
        # user logged in before
        if user.password != password:
            current_app.logger.info('Password invalid')
            return {'error': 'invalid_password'}, 401
        current_app.logger.info('Password OK')
    else:
        # user is new, try logging in to paprika
        current_app.logger.info('Trying to login to Paprika with %s', email)
        paprika_token, error = paprika.login(email, password)
        if error:
            current_app.logger.info('Paprika login failed: %s', error)
            return {'error': 'invalid_paprika_login', 'detail': error}, 422
        current_app.logger.info('Paprika login successful, creating local user')
        user = User(
            name=email.split('@')[0],
            email=email,
            password=password,
            paprika_token=paprika_token,
        )
        db.session.add(user)
        db.session.commit()
    return UserSchema().jsonify(user)


@api.route('/user/me')
@require_user
def user_me():
    return UserSchema().jsonify(g.user)


@api.route('/user/me', methods=('PATCH',))
@require_user
@use_kwargs({'name': fields.String()}, location='json')
def user_me_update(name=None):
    if name is not None:
        g.user.name = name
    db.session.commit()
    return UserSchema().jsonify(g.user)


@api.route('/user/refresh-paprika', methods=('POST',))
@require_user
def user_refresh_paprika():
    new_status = paprika.get_sync_status(g.user.paprika_token)
    todo = new_status.get_updated(g.user.paprika_sync_status)
    try:
        if 'categories' in todo:
            g.user.sync_categories()
        if 'recipes' in todo:
            g.user.sync_recipes()
        if 'photos' in todo:
            g.user.sync_photos()
        db.session.flush()
    except IntegrityError:
        return jsonify(error='sync_conflict'), 409
    g.user.paprika_sync_status = new_status
    db.session.commit()
    return {x: x in todo for x in ('categories', 'recipes', 'photos')}


@api.route('/user/partners/active/')
@require_user
def user_partners_active():
    return PartnerUserSchema(many=True).jsonify(g.user.get_active_partners())


@api.route('/user/partners/pending/')
@require_user
def user_partners_pending():
    return PendingPartnersSchema().jsonify(g.user.get_pending_partners())


@api.route('/user/partners/pending/', methods=('POST',))
@require_user
@use_kwargs({'partner_code': fields.String()}, location='json')
def user_partners_create_pending(partner_code):
    user = User.get_by_partner_code(partner_code)
    if not user:
        return jsonify(error='no_such_user'), 422
    elif user == g.user:
        return jsonify(error='cannot_add_self'), 422
    if partner := g.user.get_incoming_partner(user.id):
        current_app.logger.info('Approving pending partnership request from %s', user)
        partner.approved = True
    elif not g.user.get_outgoing_partner(user.id):
        current_app.logger.info('Creating new pending partnership request for %s', user)
        g.user.partners.append(Partner(target_user=user, approved=False))
    db.session.commit()
    return AllPartnersSchema().jsonify(g.user)


@api.route('/user/partners/active/<int:user_id>', methods=('DELETE',))
@require_user
def user_partners_delete_active(user_id):
    found = False
    if partner := g.user.get_incoming_partner(user_id):
        if not partner.approved:
            return jsonify(error='not_approved'), 400
        current_app.logger.info(
            'Removing partnership between %s and %s',
            partner.source_user,
            partner.target_user,
        )
        db.session.delete(partner)
        found = True
    if partner := g.user.get_outgoing_partner(user_id):
        if not partner.approved:
            return jsonify(error='not_approved'), 400
        current_app.logger.info(
            'Removing partnership between %s and %s',
            partner.source_user,
            partner.target_user,
        )
        db.session.delete(partner)
        found = True
    if not found:
        return jsonify(error='no_such_partner'), 404
    db.session.commit()
    return PartnerUserSchema(many=True).jsonify(g.user.get_active_partners())


@api.route('/user/partners/pending/<int:user_id>', methods=('DELETE',))
@require_user
def user_partners_delete_pending(user_id):
    found = False
    if partner := g.user.get_incoming_partner(user_id):
        if partner.approved:
            return jsonify(error='already_approved'), 400
        current_app.logger.info(
            'Rejecting partner request from %s', partner.source_user
        )
        db.session.delete(partner)
        found = True
    if partner := g.user.get_outgoing_partner(user_id):
        if partner.approved:
            return jsonify(error='already_approved'), 400
        current_app.logger.info('Cancelling partner request to %s', partner.target_user)
        db.session.delete(partner)
        found = True
    if not found:
        return jsonify(error='no_such_partner'), 404
    db.session.commit()
    return PendingPartnersSchema().jsonify(g.user.get_pending_partners())


@api.route('/user/partners/active/<int:user_id>', methods=('PUT',))
@require_user
def user_partners_approve_pending(user_id):
    if not (partner := g.user.get_incoming_partner(user_id)):
        return jsonify(error='no_such_partner'), 404
    elif partner.approved:
        return jsonify(error='already_approved'), 400
    else:
        current_app.logger.info(
            'Accepting partner request from %s', partner.source_user
        )
        partner.approved = True
    db.session.commit()
    return AllPartnersSchema().jsonify(g.user)


@api.route('/paprika/categories/')
@api.route('/user/<int:partner_id>/paprika/categories/')
@require_user
@allow_partner
def paprika_categories(user):
    return CategorySchema(many=True).jsonify(
        c for c in user.categories if c.data['parent_uid'] is None
    )


@api.route('/paprika/recipes/')
@api.route('/user/<int:partner_id>/paprika/recipes/')
@require_user
@allow_partner
def paprika_recipes(user):
    return BasicRecipeSchema(many=True).jsonify(user.recipes)


@api.route('/paprika/recipes/<int:id>/')
@api.route('/user/<int:partner_id>/paprika/recipes/<int:id>/')
@require_user
@allow_partner
def paprika_recipe(user, id):
    recipe = Recipe.query.with_parent(user).filter_by(id=id).first()
    if not recipe:
        return jsonify(error='invalid_recipe'), 404
    return RecipeSchema().jsonify(recipe)


@api.route('/paprika/recipes/<int:id>/photo')
@api.route('/user/<int:partner_id>/paprika/recipes/<int:id>/photo')
@require_user
@allow_partner
def paprika_recipe_main_photo(user, id):
    recipe = Recipe.query.with_parent(user).filter_by(id=id).first()
    if not recipe:
        return jsonify(error='invalid_recipe'), 404
    if not recipe.data['photo']:
        return jsonify(error='no_photo'), 404
    mimetype = (
        mimetypes.guess_type(recipe.data['photo'])[0] or 'application/octet-stream'
    )
    return send_file(BytesIO(recipe.image_data), mimetype=mimetype)


@api.route('/paprika/recipes/<int:id>/photos/<int:pid>')
@api.route('/user/<int:partner_id>/paprika/recipes/<int:id>/photos/<int:pid>')
@require_user
@allow_partner
def paprika_recipe_photo(user, id, pid):
    recipe = Recipe.query.with_parent(user).filter_by(id=id).first()
    if not recipe:
        return jsonify(error='invalid_recipe'), 404
    photo = recipe.get_photo(pid)
    if not photo:
        return jsonify(error='invalid_photo'), 404
    mimetype = (
        mimetypes.guess_type(photo.data['filename'])[0] or 'application/octet-stream'
    )
    return send_file(BytesIO(photo.image_data), mimetype=mimetype)
