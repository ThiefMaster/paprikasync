import React from 'react';
import {BrowserRouter as Router, Route, Switch} from 'react-router-dom';
import {Container} from 'semantic-ui-react';
import {Recipes} from './Recipes';
import {TopMenu} from './TopMenu';
import {UserSettings} from './UserSettings';
import {StoreProvider} from './util/store';

export const MainPage = () => {
  return (
    <StoreProvider>
      <Router>
        <TopMenu />
        <Container style={{marginTop: '7em', marginBottom: '2em'}}>
          <Switch>
            <Route exact path="/user">
              <UserSettings />
            </Route>
            <Route>
              <Recipes />
            </Route>
          </Switch>
        </Container>
      </Router>
    </StoreProvider>
  );
};
