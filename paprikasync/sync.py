from operator import attrgetter

import click

from . import paprika
from .config import Partner

SYNC_ROOT_NAME = 'Sync'


def get_sync_category(token, partner, *, dry_run=False) -> paprika.Category:
    categories = paprika.get_categories(token)
    max_order_flag = (
        max(categories, key=attrgetter('order_flag')).order_flag if categories else -1
    )

    sync_root = next(
        (c for c in categories if c.name.lower() == SYNC_ROOT_NAME.lower()), None
    )
    if not sync_root:
        sync_root = paprika.Category(SYNC_ROOT_NAME, order_flag=(max_order_flag + 1))
        max_order_flag += 1
        click.echo(f'Creating top-level sync category "{sync_root.name}"')
        if not dry_run:
            sync_root.save(token)

    sync_cat = next(
        (
            c
            for c in categories
            if c.parent_uid == sync_root.uid and c.name.lower() == partner.name.lower()
        ),
        None,
    )
    if not sync_cat:
        sync_cat = paprika.Category(
            partner.name, order_flag=(max_order_flag + 1), parent_uid=sync_root.uid
        )
        max_order_flag += 1
        click.echo(f'Creating sync category "{sync_cat.name}"')
        if not dry_run:
            sync_cat.save(token)

    return sync_cat


def do_sync(token: str, partner: Partner, *, dry_run: bool = False) -> None:
    own_recipes = paprika.get_recipe_list(token)
    own_uids = {r.uid for r in own_recipes}
    partner_recipes = paprika.get_recipe_list(partner.token)
    partner_photos = paprika.get_photos(partner.token)
    sync_cat = None
    for item in partner_recipes:
        if item.uid in own_uids:
            click.echo(f'Recipe {item.uid} already synced')
            continue
        recipe = paprika.get_recipe(partner.token, item.uid)
        if recipe.in_trash:
            click.echo(f'Recipe "{recipe.name}" is trashed')
            continue
        if sync_cat is None:
            sync_cat = get_sync_category(token, partner, dry_run=dry_run)
        recipe.clear_user_data()
        recipe.categories = [sync_cat.uid]
        click.echo(f'Creating recipe "{recipe.name}"')
        if not dry_run:
            recipe.save(token)
        for photo in partner_photos.get(recipe.uid, []):
            photo = paprika.get_photo(partner.token, photo.uid)
            click.echo(f'Creating photo "{photo.name}"')
            if not dry_run:
                photo.save(token)

    click.echo('Triggering client sync')
    if not dry_run:
        paprika.notify_sync(token)
