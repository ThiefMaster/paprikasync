from webargs.flaskparser import FlaskParser


def strip_whitespace(value):
    if isinstance(value, str):
        value = value.strip()
    elif isinstance(value, dict):
        return {k: strip_whitespace(v) for k, v in value.items()}
    elif isinstance(value, (list, set)):
        return type(value)(map(strip_whitespace, value))
    return value


class StrippingFlaskParser(FlaskParser):
    def _load_location_data(self, **kwargs):
        data = super()._load_location_data(**kwargs)
        return strip_whitespace(data)


parser = StrippingFlaskParser()
use_args = parser.use_args
use_kwargs = parser.use_kwargs
