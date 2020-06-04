import gzip
import itertools
from dataclasses import dataclass, field
from operator import attrgetter
from typing import List, Optional
from uuid import uuid4

import requests
from dataclasses_json import dataclass_json

API_BASE = 'https://www.paprikaapp.com/api/v2'
LOGIN_URL = f'{API_BASE}/account/login/'
SYNC_STATUS_URL = f'{API_BASE}/sync/status/'
SYNC_CATEGORIES_URL = f'{API_BASE}/sync/categories/'
SYNC_RECIPES_URL = f'{API_BASE}/sync/recipes/'
SYNC_RECIPE_URL = lambda uid: f'{API_BASE}/sync/recipe/{uid}/'  # noqa:E731
SYNC_PHOTOS_URL = f'{API_BASE}/sync/photos/'
SYNC_PHOTO_URL = lambda uid: f'{API_BASE}/sync/photo/{uid}/'  # noqa:E731
SYNC_NOTIFY_URL = f'{API_BASE}/sync/notify/'


class InvalidToken(Exception):
    pass


class RequestFailed(Exception):
    pass


@dataclass_json()
@dataclass
class Category:
    name: str
    order_flag: int
    uid: str = field(default_factory=lambda: str(uuid4()).upper())
    parent_uid: Optional[str] = None
    deleted: bool = False

    def save(self, token: str):
        resp = requests.post(
            SYNC_CATEGORIES_URL,
            files={'data': _gzip(self, wrap_list=True)},
            headers=_auth(token),
        )
        resp.raise_for_status()
        error = resp.json().get('error')
        if error:
            raise RequestFailed(error)


@dataclass_json()
@dataclass
class RecipeListItem:
    hash: str
    uid: str


@dataclass_json()
@dataclass
class Photo:
    uid: str
    filename: str
    name: str
    order_flag: int
    recipe_uid: str
    hash: str
    photo_url: Optional[str] = None
    deleted: bool = False

    def get_photo_data(self):
        if not self.photo_url:
            # we only have a url if we loaded this photo specifically using
            # its own dedicated url, not when we got just the whole list
            return None
        resp = requests.get(self.photo_url)
        resp.raise_for_status()
        return resp.content

    def save(self, token: str):
        files = {'data': _gzip(self)}
        photo_data = self.get_photo_data()
        if photo_data:
            # self.photo is the filename
            files['photo_upload'] = (self.filename, photo_data)
        resp = requests.post(
            SYNC_PHOTO_URL(self.uid), files=files, headers=_auth(token)
        )
        resp.raise_for_status()
        error = resp.json().get('error')
        if error:
            raise RequestFailed(error)


@dataclass_json()
@dataclass
class Recipe:
    categories: List[str]
    cook_time: str
    created: str
    description: str
    difficulty: str
    directions: str
    hash: str
    image_url: Optional[str]
    in_trash: bool
    ingredients: str
    is_pinned: bool
    name: str
    notes: str
    nutritional_info: str
    on_favorites: bool
    on_grocery_list: Optional[str]
    photo: Optional[str]
    photo_hash: Optional[str]
    photo_large: Optional[str]
    photo_url: Optional[str]
    prep_time: str
    rating: int
    scale: Optional[str]
    servings: str
    source: str
    source_url: str
    total_time: str
    uid: str

    def clear_user_data(self):
        self.categories = []
        self.on_grocery_list = False

    def get_photo_data(self):
        if not self.photo or not self.photo_url:
            return None
        resp = requests.get(self.photo_url)
        resp.raise_for_status()
        return resp.content

    def save(self, token: str):
        files = {'data': _gzip(self)}
        photo_data = self.get_photo_data()
        if photo_data:
            # self.photo is the filename
            files['photo_upload'] = (self.photo, photo_data)
        resp = requests.post(
            SYNC_RECIPE_URL(self.uid), files=files, headers=_auth(token)
        )
        resp.raise_for_status()
        error = resp.json().get('error')
        if error:
            raise RequestFailed(error)


def _auth(token: str) -> dict:
    return {'Authorization': f'Bearer {token}'}


def _gzip(obj, *, wrap_list=False) -> bytes:
    body = f'[{obj.to_json()}]' if wrap_list else obj.to_json()
    return gzip.compress(body.encode())


def login(email: str, password: str) -> str:
    resp = requests.post(LOGIN_URL, data={'email': email, 'password': password})
    resp.raise_for_status()
    data = resp.json()
    try:
        return data['result']['token'], None
    except KeyError:
        return None, data['error']['message']


def check_token(token: str) -> None:
    resp = requests.get(SYNC_STATUS_URL, headers=_auth(token))
    if resp.status_code == 401:
        data = resp.json()
        raise InvalidToken(data['error']['message'])
    resp.raise_for_status()


def get_categories(token: str) -> List[Category]:
    resp = requests.get(SYNC_CATEGORIES_URL, headers=_auth(token))
    resp.raise_for_status()
    data = resp.json()
    return sorted(
        (Category.from_dict(c) for c in data['result']), key=lambda c: c.order_flag
    )


def get_recipe_list(token: str) -> List[RecipeListItem]:
    resp = requests.get(SYNC_RECIPES_URL, headers=_auth(token))
    resp.raise_for_status()
    data = resp.json()
    return [RecipeListItem.from_dict(x) for x in data['result']]


def get_recipe(token: str, uid: str) -> Recipe:
    resp = requests.get(SYNC_RECIPE_URL(uid), headers=_auth(token))
    resp.raise_for_status()
    data = resp.json()
    return Recipe.from_dict(data['result'])


def notify_sync(token: str) -> None:
    resp = requests.post(SYNC_NOTIFY_URL, headers=_auth(token))
    resp.raise_for_status()


def get_photos(token: str) -> List[Photo]:
    resp = requests.get(SYNC_PHOTOS_URL, headers=_auth(token))
    resp.raise_for_status()
    data = resp.json()
    photos = sorted(
        (Photo.from_dict(x) for x in data['result']), key=attrgetter('recipe_uid')
    )
    photos_by_recipe = {
        recipe_uid: list(recipe_photos)
        for recipe_uid, recipe_photos in itertools.groupby(
            photos, key=attrgetter('recipe_uid')
        )
    }
    return photos_by_recipe


def get_photo(token: str, uid: str) -> Photo:
    resp = requests.get(SYNC_PHOTO_URL(uid), headers=_auth(token))
    resp.raise_for_status()
    data = resp.json()
    return Photo.from_dict(data['result'])
