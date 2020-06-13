import mimetypes
from io import BytesIO

from flask import Blueprint, abort, request, send_file

from .models import Recipe

# This blueprint serves files using URLs that are less guessable since we don't
# have an easy way to serve them while requiring authentication.
img = Blueprint('img', __name__, url_prefix='/image')


@img.route('/recipe/<int:id>/photo/<hash>/<name>')
def paprika_recipe_main_photo(id, hash, name):
    recipe = Recipe.query.get(id)
    if not recipe or recipe.data['photo_hash'] != hash or recipe.data['photo'] != name:
        abort(404)
    mimetype = (
        mimetypes.guess_type(recipe.data['photo'])[0] or 'application/octet-stream'
    )
    rv = send_file(BytesIO(recipe.image_data), mimetype=mimetype)
    rv.set_etag(recipe.data['photo_hash'])
    rv.make_conditional(request)
    return rv


@img.route('/recipe/<int:id>/photos/<int:pid>/<hash>/<name>')
def paprika_recipe_photo(id, pid, hash, name):
    recipe = Recipe.query.get(id)
    if not recipe:
        abort(404)
    photo = recipe.get_photo(pid)
    if not photo or photo.data['hash'] != hash or photo.data['filename'] != name:
        abort(404)
    mimetype = (
        mimetypes.guess_type(photo.data['filename'])[0] or 'application/octet-stream'
    )
    rv = send_file(BytesIO(photo.image_data), mimetype=mimetype)
    rv.set_etag(photo.data['hash'])
    rv.make_conditional(request)
    return rv
