from flask_marshmallow import Marshmallow

from .models import User


mm = Marshmallow()


class UserSchema(mm.SQLAlchemyAutoSchema):
    class Meta:
        model = User
        fields = ('email', 'token')
