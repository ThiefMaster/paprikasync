import React from 'react';
import {Button} from 'semantic-ui-react';
import {useAuth} from './util/auth';

export const MainPage = () => {
  const {name, logout} = useAuth(true);

  return (
    <>
      Welcome, {name}.<br />
      <Button onClick={logout}>Logout</Button>
    </>
  );
};
