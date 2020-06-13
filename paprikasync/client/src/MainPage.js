import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';
import {Container} from 'semantic-ui-react';
import {Recipes} from './Recipes';
import {TopMenu} from './TopMenu';

export const MainPage = () => {
  return (
    <Router>
      <TopMenu />
      <Container style={{marginTop: '7em', marginBottom: '2em'}}>
        <Recipes />
      </Container>
    </Router>
  );
};
