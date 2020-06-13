import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';
import {Container} from 'semantic-ui-react';
import {Recipes} from './Recipes';
import {TopMenu} from './TopMenu';
import {StoreProvider} from './util/store';

export const MainPage = () => {
  return (
    <StoreProvider>
      <Router>
        <TopMenu />
        <Container style={{marginTop: '7em', marginBottom: '2em'}}>
          <Recipes />
        </Container>
      </Router>
    </StoreProvider>
  );
};
