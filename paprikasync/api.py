from functools import wraps
from uuid import UUID

from flask import Blueprint, current_app, g, jsonify, request
from webargs import fields
from webargs.flaskparser import use_kwargs
from werkzeug.exceptions import HTTPException, UnprocessableEntity

from . import paprika
from .models import User, db
from .schemas import UserSchema

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
            return {'error': 'invalid_paprika_login', 'detail': error}
        current_app.logger.info('Paprika login successful, creating local user')
        user = User(email=email, password=password, paprika_token=paprika_token)
        db.session.add(user)
        db.session.commit()
    return UserSchema().jsonify(user)


@api.route('/user/me')
@require_user
def user_me():
    return UserSchema().jsonify(g.user)


@api.route('/user/refresh-paprika', methods=('POST',))
@require_user
def user_refresh_paprika():
    new_status = paprika.get_sync_status(g.user.paprika_token)
    todo = new_status.get_updated(g.user.paprika_sync_status)
    if 'categories' in todo:
        g.user.sync_categories()
    if 'recipes' in todo:
        g.user.sync_recipes()
    if 'photos' in todo:
        g.user.sync_photos()
    g.user.paprika_sync_status = new_status
    db.session.commit()
    return {x: x in todo for x in ('categories', 'recipes', 'photos')}
