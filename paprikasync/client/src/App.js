import React from 'react';
import {useAuth} from './util/auth';
import {LoginForm} from './LoginForm';
import {MainPage} from './MainPage';

export const App = () => {
  const {loggedIn} = useAuth(true);
  return loggedIn ? <MainPage /> : <LoginForm />;
};
