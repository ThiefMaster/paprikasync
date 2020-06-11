import React from 'react';
import {Button} from 'semantic-ui-react';
import {LoginForm} from './LoginForm';
import {useAuth} from './util/auth';

export const App = () => {
  const {loggedIn, name, logout} = useAuth(true);
  return (
    <div className="App">
      {loggedIn ? (
        <>
          Welcome, {name}.<br />
          <Button onClick={logout}>Logout</Button>
        </>
      ) : (
        <LoginForm />
      )}
    </div>
  );
};
