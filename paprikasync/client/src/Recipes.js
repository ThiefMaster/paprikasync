import flask from 'flask-urls.macro';
import React, {useEffect, useState} from 'react';
import {Container, Item, Loader, Message, Input, Icon} from 'semantic-ui-react';
import placeholder from './placeholder.png';
import {fetchJSON} from './util/fetch';
import {smartContains} from './util/string';

const RecipeItem = ({recipe}) => (
  <Item>
    <Item.Image src={recipe.photo_url || placeholder} />
    <Item.Content verticalAlign="middle">
      <Item.Header>{recipe.name}</Item.Header>
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

export const Recipes = () => {
  const [recipes, setRecipes] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    (async () => {
      const [, resp] = await fetchJSON(flask`api.paprika_recipes`());
      setRecipes(resp);
    })();
  }, []);

  const filteredRecipes = (recipes || []).filter(r => smartContains(r.name, filter));

  return (
    <Container text style={{marginTop: '7em', marginBottom: '2em'}}>
      <div style={{display: 'flex', justifyContent: 'flex-end'}}>
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
      {recipes === null ? (
        <Loader active>Loading recipes...</Loader>
      ) : recipes.length === 0 ? (
        <Message content="You do not have any recipes yet." warning />
      ) : filteredRecipes.length === 0 ? (
        <Message content="No recipes match your filter." warning />
      ) : (
        <RecipeList recipes={filteredRecipes} filter={filter.trim()} />
      )}
    </Container>
  );
};
