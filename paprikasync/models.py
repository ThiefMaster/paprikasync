from __future__ import annotations

import dataclasses
from typing import Callable, Iterable, Tuple
from uuid import uuid4

import requests
from flask import current_app
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm.relationships import foreign
from sqlalchemy_utils import PasswordType

from . import paprika

db = SQLAlchemy()


db.Model.metadata.naming_convention = {
    'fk': 'fk_%(table_name)s_%(column_names)s_%(referred_table_name)s',
    'pk': 'pk_%(table_name)s',
    'ix': 'ix_%(unique_index)s%(table_name)s_%(column_names)s',
    'ck': 'ck_%(table_name)s_%(constraint_name)s',
    'uq': 'uq_%(table_name)s_%(column_names)s',
    'column_names': lambda constraint, table: '_'.join(
        (c if isinstance(c, str) else c.name) for c in constraint.columns
    ),
    'unique_index': lambda constraint, table: 'uq_' if constraint.unique else '',
}


class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = (db.CheckConstraint('email = lower(email)', 'lowercase_email'),)

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String, nullable=False, unique=True)
    password = db.Column(PasswordType(schemes=['argon2']), nullable=False)
    token = db.Column(
        UUID, default=lambda: str(uuid4()), nullable=False, unique=True, index=True
    )
    paprika_token = db.Column(db.String, nullable=False)
    _paprika_sync_status = db.Column(
        'paprika_sync_status', JSONB, nullable=False, default={}
    )

    categories = db.relationship('Category', backref='user')
    photos = db.relationship('Photo', backref='user')
    recipes = db.relationship('Recipe', backref='user')

    @property
    def paprika_sync_status(self) -> paprika.SyncStatus:
        return paprika.SyncStatus.from_dict(self._paprika_sync_status)

    @paprika_sync_status.setter
    def paprika_sync_status(self, value: paprika.SyncStatus):
        self._paprika_sync_status = dataclasses.asdict(value)

    def sync_categories(self) -> None:
        Category.sync(self)

    def sync_photos(self) -> None:
        Photo.sync(self)

    def sync_recipes(self) -> None:
        Recipe.sync(self)

    def __repr__(self):
        return f'<User({self.id}): {self.email}>'


class PaprikaModel(db.Model):
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    data = db.Column('data', JSONB, nullable=False)

    @declared_attr
    def user_id(cls):
        return db.Column(db.ForeignKey(User.id))

    @hybrid_property
    def uid(self) -> str:
        return self.data['uid']

    @uid.expression
    def uid(cls):
        return cls.data['uid'].astext

    def __repr__(self):
        clsname = type(self).__name__
        name = self.data['name']
        return f'<{clsname}({self.id}, {self.uid}): {name}>'

    @classmethod
    def sync(cls, user: User) -> Tuple[set, set, set]:
        raise NotImplementedError

    @classmethod
    def _sync(
        cls,
        user: User,
        collection_name: str,
        new: Iterable[dict],
        get_data: Callable = lambda data: data,
        compare_objs: Callable = lambda old, new: old.data == new,
    ) -> Tuple[set, set, set]:
        current_app.logger.info('Running sync (%s)', collection_name)
        collection = getattr(user, collection_name)
        current = {obj.uid: obj for obj in collection}
        new = {data['uid']: data for data in new}
        current_uids = current.keys()
        new_uids = new.keys()
        new_objs = set()
        deleted_objs = set()
        updated_objs = set()
        # deleted
        for uid in current_uids - new_uids:
            obj = current[uid]
            current_app.logger.info('Deleting %r', obj)
            db.session.delete(obj)
            deleted_objs.add(obj)
        # existing, maybe updated
        for uid in current_uids & new_uids:
            obj = current[uid]
            if compare_objs(obj, new[uid]):
                # current_app.logger.info('Nothing to do for %r', obj)
                continue
            current_app.logger.info('Updating %r', obj)
            obj.data = get_data(new[uid])
            updated_objs.add(obj)
        # new
        for uid in new_uids - current_uids:
            obj = cls(data=get_data(new[uid]))
            current_app.logger.info('Adding %r', obj)
            collection.append(obj)
            new_objs.add(obj)
        return new_objs, updated_objs, deleted_objs


class Category(PaprikaModel):
    __tablename__ = 'categories'

    @classmethod
    def sync(cls, user: User) -> Tuple[set, set, set]:
        return cls._sync(
            user, 'categories', paprika.get_categories_raw(user.paprika_token)
        )


class Photo(PaprikaModel):
    __tablename__ = 'photos'

    image_data = db.deferred(db.Column(db.LargeBinary, nullable=False))

    @classmethod
    def sync(cls, user: User) -> Tuple[set, set, set]:
        new = paprika.get_photos_raw(user.paprika_token)
        added, updated, deleted = cls._sync(user, 'photos', new)
        for photo in added:
            photo.download(user.paprika_token)
        return added, updated, deleted

    def download(self, paprika_token: str) -> None:
        current_app.logger.info('Downloading photo %r', self)
        data = paprika.get_photo_raw(paprika_token, self.uid)
        photo_url = data.pop('photo_url')
        if self.data != data:
            current_app.logger.warning(
                'Photo data changed during sync: %r != %r', self.data, data
            )
            self.data = data
        resp = requests.get(photo_url)
        resp.raise_for_status()
        self.image_data = resp.content


class Recipe(PaprikaModel):
    __tablename__ = 'recipes'

    image_data = db.deferred(db.Column(db.LargeBinary, nullable=True))

    photos = db.relationship(
        'Photo',
        viewonly=True,
        lazy='joined',
        primaryjoin=lambda: db.and_(
            db.cast(Recipe.data, JSONB)['uid']
            == foreign(db.cast(Photo.data, JSONB)['recipe_uid']),
            Recipe.user_id == Photo.user_id,
        ),
        backref='recipe',
        sync_backref=False,
    )

    @classmethod
    def sync(cls, user: User) -> Tuple[set, set, set]:
        added, updated, deleted = cls._sync(
            user,
            'recipes',
            paprika.get_recipe_list_raw(user.paprika_token),
            lambda data: paprika.get_recipe_raw(user.paprika_token, data['uid']),
            lambda old, new: old.hash == new['hash'],
        )
        for recipe in added | updated:
            recipe.download_photo(user.paprika_token)
        return added, updated, deleted

    @property
    def hash(self) -> str:
        return self.data['hash']

    def download_photo(self, paprika_token: str) -> None:
        current_app.logger.info('Recipe %r has no photo', self)
        if not self.data['photo'] or not self.data['photo_url']:
            self.image_data = None
            return
        current_app.logger.info('Downloading photo for recipe %r', self)
        resp = requests.get(self.data['photo_url'])
        resp.raise_for_status()
        self.image_data = resp.content
