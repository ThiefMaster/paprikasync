from __future__ import annotations

import dataclasses
import re
from typing import Callable, Iterable, Tuple
from uuid import uuid4

import requests
from flask import current_app
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import orm
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.event import listens_for
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import column_property, joinedload
from sqlalchemy.orm.relationships import foreign
from sqlalchemy.sql import select
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


def data_property(key):
    return property(lambda self: self.data[key])


class User(db.Model):
    __tablename__ = 'users'
    __table_args__ = (db.CheckConstraint('email = lower(email)', 'lowercase_email'),)

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False)
    email = db.Column(db.String, nullable=False, unique=True)
    password = db.Column(PasswordType(schemes=['argon2']), nullable=False)
    token = db.Column(
        UUID, default=lambda: str(uuid4()), nullable=False, unique=True, index=True
    )
    paprika_token = db.Column(db.String, nullable=False)
    _paprika_sync_status = db.Column(
        'paprika_sync_status', JSONB, nullable=False, default={}
    )

    categories = db.relationship(
        'Category', backref='user', order_by=lambda: Category.data['order_flag']
    )
    photos = db.relationship('Photo', backref='user')
    recipes = db.relationship('Recipe', backref='user')

    @property
    def paprika_sync_status(self) -> paprika.SyncStatus:
        return paprika.SyncStatus.from_dict(self._paprika_sync_status)

    @paprika_sync_status.setter
    def paprika_sync_status(self, value: paprika.SyncStatus):
        self._paprika_sync_status = dataclasses.asdict(value)

    @property
    def partner_code(self):
        slug = re.sub(r'[-\s]+', '-', re.sub(r'[^\w\s-]', '', self.name).strip())
        return f'{slug}#{self.id}'

    @classmethod
    def get_by_partner_code(cls, partner_code):
        try:
            slug, id = partner_code.split('#', 1)
            id = int(id)
        except ValueError:
            return None
        user = cls.query.get(id)
        if not user or user.partner_code != partner_code:
            return None
        return user

    def sync_categories(self) -> None:
        Category.sync(self)

    def sync_photos(self) -> None:
        Photo.sync(self)

    def sync_recipes(self) -> None:
        Recipe.sync(self)

    def get_active_partners(self):
        partners = (
            Partner.query.filter(
                (Partner.source_user == self) | (Partner.target_user == self)
            )
            .filter_by(approved=True)
            .options(joinedload('source_user'), joinedload('target_user'))
            .all()
        )
        return {
            p.source_user if p.target_user == self else p.target_user for p in partners
        }

    def get_active_partner(self, user_id):
        return next((u for u in self.get_active_partners() if u.id == user_id), None)

    def get_pending_partners(self):
        return {
            'incoming': {p.source_user for p in self.partner_of if not p.approved},
            'outgoing': {p.target_user for p in self.partners if not p.approved},
        }

    def get_incoming_partner(self, user_id):
        return Partner.query.filter_by(target_user=self, source_user_id=user_id).first()

    def get_outgoing_partner(self, user_id):
        return Partner.query.filter_by(source_user=self, target_user_id=user_id).first()

    def __repr__(self):
        return f'<User({self.id}): {self.email}>'


@listens_for(orm.mapper, 'after_configured', once=True)
def _mappers_configured():
    query = (
        select([db.func.count(Recipe.id)])
        .where(Recipe.user_id == User.id)
        .correlate_except(Recipe)
    )
    User.recipe_count = column_property(query, deferred=True)


class Partner(db.Model):
    __tablename__ = 'partners'

    source_user_id = db.Column(db.ForeignKey(User.id), index=True, primary_key=True)
    target_user_id = db.Column(db.ForeignKey(User.id), index=True, primary_key=True)
    approved = db.Column(db.Boolean, nullable=False, default=False)

    source_user = db.relationship(
        User, foreign_keys=source_user_id, lazy=False, backref='partners'
    )
    target_user = db.relationship(
        User, foreign_keys=target_user_id, lazy=False, backref='partner_of'
    )

    def __repr__(self):
        return (
            f'<Partner({self.source_user_id}, {self.target_user_id}): {self.approved})>'
        )


class PaprikaModel(db.Model):
    __abstract__ = True

    @declared_attr
    def __table_args__(cls):
        return (db.Index(None, cls.user_id, cls.uid, unique=True),)

    id = db.Column(db.Integer, primary_key=True)
    data = db.Column('data', JSONB, nullable=False)

    @declared_attr
    def user_id(cls):
        return db.Column(db.ForeignKey(User.id), index=True)

    @hybrid_property
    def uid(self) -> str:
        return self.data['uid']

    @uid.expression
    def uid(cls):
        return cls.data['uid'].astext

    name = data_property('name')
    in_trash = data_property('in_trash')

    def __repr__(self):
        clsname = type(self).__name__
        return f'<{clsname}({self.id}, {self.uid}): {self.name}>'

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

    @property
    def children(self):
        return [c for c in self.user.categories if c.data['parent_uid'] == self.uid]

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
            if 'uid' in data:
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
            recipe._download_photo(user.paprika_token)
        return added, updated, deleted

    hash = data_property('hash')

    def _download_photo(self, paprika_token: str) -> None:
        current_app.logger.info('Recipe %r has no photo', self)
        if not self.data['photo'] or not self.data['photo_url']:
            self.image_data = None
            return
        current_app.logger.info('Downloading photo for recipe %r', self)
        resp = requests.get(self.data['photo_url'])
        resp.raise_for_status()
        self.image_data = resp.content

    def get_photo(self, id):
        return next((p for p in self.photos if p.id == id), None)
