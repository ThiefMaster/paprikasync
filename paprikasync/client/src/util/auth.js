import React, {createContext, useContext, useReducer, useEffect} from 'react';
import flask from 'flask-urls.macro';
import {fetchJSON} from './fetch';

const AuthContext = createContext();

export const getToken = () => localStorage.getItem('token');

const token = getToken();
const initialState = {loggedIn: false, refreshing: !!token, user: null, token};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('token', action.user.token);
      return {
        loggedIn: true,
        refreshing: false,
        user: action.user,
        token: action.user.token,
      };
    case 'REFRESH':
      return {
        ...state,
        loggedIn: true,
        refreshing: false,
        user: action.user,
      };
    case 'RENAME':
      return {
        ...state,
        user: action.user,
      };
    case 'LOGOUT':
      localStorage.clear();
      return {
        loggedIn: false,
        refreshing: false,
        user: null,
        token: null,
      };
    default:
      return state;
  }
};

export const useAuth = (topLevel = false) => {
  const {dispatch, ...state} = useContext(AuthContext);

  useEffect(() => {
    if (!topLevel || !state.token || state.user) {
      return;
    }

    (async () => {
      const [status, resp] = await fetchJSON(flask`api.user_me`());
      if (status === 200) {
        console.log(`Refresh successful for ${resp.email} (${resp.name})`);
        dispatch({type: 'REFRESH', user: resp});
      } else {
        console.log('Refresh failed; logging out');
        dispatch({type: 'LOGOUT'});
      }
    })();
  }, [dispatch, topLevel, state.user, state.token]);

  const login = user => {
    console.log(`Logging in as ${user.name}`);
    dispatch({type: 'LOGIN', user});
  };

  const logout = () => {
    console.log('Logging out');
    dispatch({type: 'LOGOUT'});
  };

  const rename = user => {
    console.log(`User renamed to ${user.name}`);
    dispatch({type: 'RENAME', user});
  };

  return {...state, login, logout, rename};
};

export const AuthProvider = ({children}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <AuthContext.Provider value={{...state, dispatch}}>{children}</AuthContext.Provider>;
};
