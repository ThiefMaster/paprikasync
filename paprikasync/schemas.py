from flask import url_for
from flask_marshmallow import Marshmallow
from marshmallow import post_dump
from webargs.fields import Function, Integer, List, Nested, Pluck

from .models import Category, Photo, Recipe, User

mm = Marshmallow()


class UserSchema(mm.SQLAlchemyAutoSchema):
    class Meta:
        model = User
        fields = ('id', 'name', 'email', 'token', 'partner_code')


class PartnerUserSchema(mm.SQLAlchemyAutoSchema):
    class Meta:
        model = User
        fields = ('id', 'name', 'recipe_count')

    recipe_count = Integer()


class PendingPartnersSchema(mm.Schema):
    incoming = List(Nested(PartnerUserSchema, exclude=('recipe_count',)))
    outgoing = List(Nested(PartnerUserSchema, exclude=('recipe_count',)))


class AllPartnersSchema(mm.Schema):
    active = Function(
        lambda user: PartnerUserSchema(many=True).dump(user.get_active_partners())
    )
    pending = Function(
        lambda user: PendingPartnersSchema().dump(user.get_pending_partners())
    )


class CategorySchema(mm.SQLAlchemyAutoSchema):
    class Meta:
        model = Category
        fields = ('id', 'name', 'uid', 'data', 'children')

    children = List(Nested(lambda: CategorySchema))


class BasicRecipeSchema(mm.SQLAlchemyAutoSchema):
    class Meta:
        model = Recipe
        fields = ('id', 'name', 'in_trash', 'photo_url', 'categories')

    photo_url = Function(
        lambda r: url_for(
            'img.paprika_recipe_main_photo',
            id=r.id,
            hash=r.data['photo_hash'],
            name=r.data['photo'],
        )
        if r.data['photo']
        else None
    )

    categories = Function(lambda r: r.data['categories'])

    @post_dump(pass_many=True)
    def sort_list(self, data, many, **kwargs):
        if many:
            data = sorted(data, key=lambda r: r['name'].lower())
        return data


class PhotoSchema(mm.SQLAlchemyAutoSchema):
    class Meta:
        model = Photo
        fields = ('id', 'data', 'url')

    url = Function(
        lambda p: url_for(
            'img.paprika_recipe_photo',
            id=p.recipe.id,
            pid=p.id,
            hash=p.data['hash'],
            name=p.data['filename'],
        )
    )


class RecipeSchema(mm.SQLAlchemyAutoSchema):
    class Meta:
        model = Recipe
        fields = ('id', 'name', 'in_trash', 'photo_url', 'photos', 'data')

    photo_url = Function(
        lambda r: url_for(
            'img.paprika_recipe_main_photo',
            id=r.id,
            hash=r.data['photo_hash'],
            name=r.data['photo'],
        )
        if r.data['photo']
        else None
    )
    photos = List(Pluck(PhotoSchema, 'url'))

    @post_dump()
    def sanitize_data(self, data, **kwargs):
        # the s3 url is useless
        del data['data']['photo_url']
        return data
