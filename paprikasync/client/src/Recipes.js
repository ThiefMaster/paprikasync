import React, {useEffect, useMemo, useState} from 'react';
import {Link, Route, Switch, useRouteMatch} from 'react-router-dom';
import {Header, Icon, Input, Item, Label, Loader, Message} from 'semantic-ui-react';
import placeholder from './placeholder.png';
import {Recipe} from './Recipe';
import {useRestoreScroll} from './util/router';
import {useStore} from './util/store';
import {joinPaths, smartContains} from './util/string';

const RecipeItem = ({recipe, categories, url}) => (
  <Item>
    <Item.Image
      as={Link}
      to={joinPaths(url, `/recipe/${recipe.id}`)}
      src={recipe.photo_url || placeholder}
    />
    <Item.Content verticalAlign="middle">
      <Item.Header as={Link} to={joinPaths(url, `/recipe/${recipe.id}`)}>
        {recipe.name}
      </Item.Header>
      {!!categories.length && (
        <Item.Extra>
          {categories.map(c => (
            <Label key={c} color="teal" circular>
              {c}
            </Label>
          ))}
        </Item.Extra>
      )}
    </Item.Content>
  </Item>
);

const RecipeList = ({recipes, categoryMap, url}) => {
  return (
    <Item.Group divided>
      {recipes.map(r => (
        <RecipeItem
          key={r.id}
          recipe={r}
          categories={r.categories.map(c => categoryMap[c]).filter(c => c)}
          url={url}
        />
      ))}
    </Item.Group>
  );
};

const RecipeListContainer = ({setFilter, filter, recipes, categoryMap, partnerName, url}) => {
  const filteredRecipes = useMemo(
    () => (recipes || []).filter(r => smartContains(r.name, filter)),
    [filter, recipes]
  );

  useRestoreScroll();

  return (
    <>
      <div className="recipe-list-header">
        <Header as="h1">{partnerName ? `Recipes of ${partnerName}` : 'My recipes'}</Header>
        <div>
          <Input
            placeholder="Search"
            onChange={(evt, {value}) => setFilter(value)}
            value={filter}
            error={recipes && !!recipes.length && !filteredRecipes.length}
            icon={
              <Icon
                name="x"
                link
                onClick={() => setFilter('')}
                style={filter.trim() ? {} : {display: 'none'}}
              />
            }
          />
        </div>
      </div>
      {recipes === null ? (
        <Loader active>Loading recipes...</Loader>
      ) : recipes.length === 0 ? (
        <Message
          content={
            partnerName
              ? `${partnerName} does not have any recipes yet.`
              : 'You do not have any recipes yet.'
          }
          warning
        />
      ) : filteredRecipes.length === 0 ? (
        <Message content="No recipes match your filter." warning />
      ) : (
        <RecipeList
          recipes={filteredRecipes}
          filter={filter.trim()}
          categoryMap={categoryMap}
          url={url}
        />
      )}
    </>
  );
};

export const Recipes = () => {
  const {
    categories,
    recipes,
    selectedPartner,
    selectedPartnerName,
    loadCategories,
    loadRecipes,
  } = useStore();
  const [filter, setFilter] = useState('');
  const {path, url} = useRouteMatch();

  useEffect(() => {
    loadCategories(selectedPartner);
    loadRecipes(selectedPartner);
  }, [loadCategories, loadRecipes, selectedPartner]);

  return (
    <Switch>
      <Route exact path={path}>
        <RecipeListContainer
          recipes={recipes}
          filter={filter}
          setFilter={setFilter}
          categoryMap={categories}
          partnerName={selectedPartnerName}
          url={url}
        />
      </Route>
      <Route exact path={joinPaths(path, '/recipe/:id')}>
        <Recipe categoryMap={categories} partner={selectedPartner} />
      </Route>
    </Switch>
  );
};
