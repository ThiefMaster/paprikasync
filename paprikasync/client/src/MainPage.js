import React from 'react';
import {BrowserRouter as Router, Redirect, Route, Switch} from 'react-router-dom';
import {Container} from 'semantic-ui-react';
import {Recipes} from './Recipes';
import {TopMenu} from './TopMenu';
import {UserSettings} from './UserSettings';
import {StoreProvider} from './util/store';

export const MainPage = () => {
  return (
    <StoreProvider>
      <Router>
        <Route path={['/partner/:partnerId/recipes/', '/recipes/', '/']}>
          <TopMenu />
        </Route>
        <Container className="content-container">
          <Switch>
            <Route exact path="/user">
              <UserSettings />
            </Route>
            <Route path={['/partner/:partnerId/recipes/', '/recipes/']}>
              <Recipes />
            </Route>
            <Route exact path="/">
              <Redirect push={false} to="/recipes/" />
            </Route>
            <Route exact path="/partner/:partnerId/">
              <Redirect push={false} to="./recipes/" />
            </Route>
          </Switch>
        </Container>
      </Router>
    </StoreProvider>
  );
};
