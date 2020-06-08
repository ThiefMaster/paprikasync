from flask import Flask

from .api import api
from .models import db
from .schemas import mm

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql:///paprikasync'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)
mm.init_app(app)

app.register_blueprint(api)
