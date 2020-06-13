import flask from 'flask-urls.macro';
import React, {useEffect, useMemo, useState} from 'react';
import {Link, Route, Switch} from 'react-router-dom';
import {Header, Icon, Input, Item, Loader, Message} from 'semantic-ui-react';
import placeholder from './placeholder.png';
import {Recipe} from './Recipe';
import {fetchJSON} from './util/fetch';
import {useRestoreScroll} from './util/router';
import {smartContains} from './util/string';

const RecipeItem = ({recipe}) => (
  <Item>
    <Item.Image as={Link} to={`/recipe/${recipe.id}`} src={recipe.photo_url || placeholder} />
    <Item.Content verticalAlign="middle">
      <Item.Header as={Link} to={`/recipe/${recipe.id}`}>
        {recipe.name}
      </Item.Header>
    </Item.Content>
  </Item>
);

const RecipeList = ({recipes}) => {
  return (
    <Item.Group divided>
      {recipes.map(r => (
        <RecipeItem key={r.id} recipe={r} />
      ))}
    </Item.Group>
  );
};

const RecipeListContainer = ({setFilter, filter, recipes}) => {
  const filteredRecipes = useMemo(
    () => (recipes || []).filter(r => smartContains(r.name, filter)),
    [filter, recipes]
  );

  useRestoreScroll();

  return (
    <>
      <div className="recipe-list-header">
        <Header as="h1">My recipes</Header>
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
        <Message content="You do not have any recipes yet." warning />
      ) : filteredRecipes.length === 0 ? (
        <Message content="No recipes match your filter." warning />
      ) : (
        <RecipeList recipes={filteredRecipes} filter={filter.trim()} />
      )}
    </>
  );
};

export const Recipes = () => {
  const [recipes, setRecipes] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      const [, resp] = await fetchJSON(flask`api.paprika_recipes`());
      setRecipes(resp);
    })();
  }, []);

  return (
    <Switch>
      <Route exact path="/">
        <RecipeListContainer recipes={recipes} filter={filter} setFilter={setFilter} />
      </Route>
      <Route exact path="/recipe/:id" component={Recipe} />
    </Switch>
  );
};
