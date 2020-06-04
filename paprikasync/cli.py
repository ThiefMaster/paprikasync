import sys
from functools import wraps

import click

from . import paprika
from .config import Config, load_config
from .sync import do_sync

pass_config = click.make_pass_decorator(Config)


def require_login(fn):
    @wraps(fn)
    def wrapper(config, *args, **kwargs):
        if not config.user_token:
            click.secho('You need to login first', fg='yellow', bold=True)
            sys.exit(1)
        return fn(config, *args, **kwargs)

    return wrapper


def _prompt_token():
    email = click.prompt('Email')
    password = click.prompt('Password', hide_input=True)
    token, error = paprika.login(email, password)
    if error:
        click.secho(f'Login failed: {error}', fg='red', bold=True)
        sys.exit(1)
    return token


@click.group()
@click.pass_context
def cli(ctx):
    """
    This tool lets you synchronize Paprika recipes from your friends.
    To use it, first use `paprikasync login` to login to your own
    account.

    Then acquire credentials for your friends' accounts and add them
    with `paprikasync partner add NAME`.

    To actually synchronize recipes, use `paprikasync run`.
    """
    ctx.obj = load_config()


@cli.command()
@click.option(
    '--dry-run',
    '-n',
    is_flag=True,
    help='Do not actually update anything in your account',
)
@click.option(
    '--partner',
    '-p',
    'only_partner',
    metavar='NAME',
    help='Only sync from the specified partner',
)
@pass_config
@require_login
def run(config: Config, dry_run: bool, only_partner: str):
    """Synchronize recipes from your partners."""
    if not config.partners:
        click.echo('You do not have any partners yet.')
        return
    found = False
    for partner in config.partners:
        if only_partner and partner.name.lower() != only_partner.lower():
            continue
        found = True
        do_sync(config.user_token, partner, dry_run=dry_run)
    if only_partner and not found:
        click.secho('No such partner', fg='yellow', bold=True)
        sys.exit(1)


@cli.command()
@pass_config
def login(config: Config):
    """Login to YOUR Paprika account.

    Use this command to login to your own account. This is the account
    recipes will be synced to.
    """
    if config.user_token:
        click.confirm('You are already logged in. Continue anyway?', abort=True)
    token = _prompt_token()
    config.user_token = token
    config.save()
    click.secho('Logged in successfully!', fg='green', bold=True)


@cli.command()
@pass_config
@require_login
def logout(config: Config):
    """Logout from your Paprika account."""
    config.user_token = None
    config.save()
    click.echo('Logged out successfully!')


@cli.command()
@pass_config
@require_login
def token(config: Config):
    """Print your login token.

    This is the token to give to your TRUSTED friend so they can sync
    your recipes to their own account. Note that this token gives them
    full control over your account (yes, this includes editing/deleting
    recipes). Due to the lack of an official API with limited OAuth scopes
    we cannot avoid this.
    """
    click.secho(
        'Send this token to a trusted friend using a secure channel:',
        fg='blue',
        bold=True,
    )
    click.echo(config.user_token)


@cli.group()
def partner():
    """Manage your partners."""


@partner.command('list')
@pass_config
def partner_list(config: Config):
    """List your current partners."""
    if not config.partners:
        click.echo('You do not have any partners yet.')
        return
    click.echo('Your partners:')
    for partner in config.partners:
        click.echo(f'- {partner.name}')


@partner.command('add')
@click.argument('name')
@click.option(
    '--credentials', is_flag=True, help='Use email/password instead of a token.'
)
@pass_config
def partner_add(config: Config, name: str, credentials: bool):
    """Add a new partner.

    Adding a partner is usually done by entering their token, but if they
    are with you and want to enter their credentials (they are not stored)
    instead, you can use `--credentials` for that.

    Your partner can export their token for you using `paprikasync token`.
    """
    if not name or any(p.name.lower() == name.lower() for p in config.partners):
        click.secho('Invalid name or already in use', fg='red', bold=True)
        sys.exit(1)
    if credentials:
        token = _prompt_token()
    else:
        token = click.prompt('Token')
        try:
            paprika.check_token(token)
        except paprika.InvalidToken as exc:
            click.secho(f'Invalid token: {exc}', fg='red', bold=True)
            sys.exit(1)
    config.add_partner(name, token)
    click.secho('Partner added!', fg='green', bold=True)
    config.save()


@partner.command('del')
@click.argument('name')
@pass_config
def partner_del(config: Config, name: str):
    """Remove a partner.

    Removing a partner will not remove anything already synced from them.
    """
    for i, partner in enumerate(config.partners):
        if partner.name.lower() == name.lower():
            del config.partners[i]
            click.secho('Partner removed!', fg='green', bold=True)
            break
    else:
        click.secho('No such partner', fg='yellow', bold=True)
        sys.exit(1)
    config.save()
