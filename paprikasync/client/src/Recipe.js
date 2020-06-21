import flask from 'flask-urls.macro';
import React, {useEffect, useState} from 'react';
import Markdown from 'react-markdown';
import {useParams} from 'react-router-dom';
import breaks from 'remark-breaks';
import {Divider, Grid, Header, Icon, Image, Loader, Modal, Label} from 'semantic-ui-react';
import {fetchJSON} from './util/fetch';
import {useRestoreScroll} from './util/router';

export const Recipe = ({categoryMap, partner}) => {
  const {id} = useParams();
  const [recipe, setRecipe] = useState(null);
  const [modalImage, setModalImage] = useState(null);

  useEffect(() => {
    (async () => {
      const urlParams = {id};
      if (partner) {
        urlParams.partner_id = partner;
      }

      const [, resp] = await fetchJSON(flask`api.paprika_recipe`(urlParams));
      setRecipe(resp);
    })();
  }, [id, partner]);

  useRestoreScroll(recipe !== null);

  if (recipe === null) {
    return <Loader active>Loading recipe...</Loader>;
  }

  const categories = recipe.data.categories.map(c => categoryMap[c]).filter(c => c);

  // some recipes don't have any large photos attached, just the "embedded" one
  const extraPhoto = !recipe.data.photo_large && recipe.photo_url ? recipe.photo_url : null;

  return (
    <>
      <Header as="h1">
        {recipe.name}
        {categories.map(c => (
          <Label key={c} color="teal" circular>
            {c}
          </Label>
        ))}
      </Header>
      {(extraPhoto || !!recipe.photos.length) && (
        <div className="recipe-photos">
          {extraPhoto && <Image src={extraPhoto} />}
          {recipe.photos.map(p => (
            <Image key={p} src={p} style={{cursor: 'pointer'}} onClick={() => setModalImage(p)} />
          ))}
          <Modal open={!!modalImage} size="large" onClose={() => setModalImage(null)}>
            <Image src={modalImage} onClick={() => setModalImage(null)} />
          </Modal>
        </div>
      )}
      <Grid columns={3}>
        <Grid.Row>
          <Grid.Column width={4}>
            <Divider horizontal>
              <Header as="h4">
                <Icon name="shopping basket" />
                Ingredients
              </Header>
            </Divider>
            <div className="text-content">
              <Markdown source={recipe.data.ingredients} plugins={[breaks]} />
            </div>
          </Grid.Column>
          <Grid.Column width={12}>
            {recipe.data.description && (
              <>
                <Divider horizontal>
                  <Header as="h4">
                    <Icon name="info" />
                    Description
                  </Header>
                </Divider>
                <div className="text-content">
                  <Markdown source={recipe.data.description} plugins={[breaks]} />
                </div>
              </>
            )}
            <Divider horizontal>
              <Header as="h4">
                <Icon name="book" />
                Directions
              </Header>
            </Divider>
            <div className="text-content">
              <Markdown source={recipe.data.directions} plugins={[breaks]} />
            </div>
            {recipe.data.notes && (
              <>
                <Divider horizontal>
                  <Header as="h4">
                    <Icon name="pencil" />
                    Notes
                  </Header>
                </Divider>
                <div className="text-content">
                  <Markdown source={recipe.data.notes} plugins={[breaks]} />
                </div>
              </>
            )}
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </>
  );
};
