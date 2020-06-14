import React, {createContext, useContext, useReducer, useEffect} from 'react';
import flask from 'flask-urls.macro';
import {fetchJSON} from './fetch';

const AuthContext = createContext();

export const getToken = () => localStorage.getItem('token');

const token = getToken();
const initialState = {loggedIn: false, refreshing: !!token, name: null, token};

const reducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('token', action.token);
      return {
        loggedIn: true,
        refreshing: false,
        name: action.name,
        token: action.token,
      };
    case 'REFRESH':
      return {
        ...state,
        loggedIn: true,
        refreshing: false,
        name: action.name,
      };
    case 'LOGOUT':
      localStorage.clear();
      return {
        loggedIn: false,
        refreshing: false,
        name: null,
        token: null,
      };
    default:
      return state;
  }
};

export const useAuth = (topLevel = false) => {
  const {dispatch, ...state} = useContext(AuthContext);

  useEffect(() => {
    if (!topLevel || !state.token || state.name) {
      return;
    }

    (async () => {
      const [status, resp] = await fetchJSON(flask`api.user_me`());
      if (status === 200) {
        console.log(`Refresh successful for ${resp.email} (${resp.name})`);
        dispatch({type: 'REFRESH', name: resp.name});
      } else {
        console.log('Refresh failed; logging out');
        dispatch({type: 'LOGOUT'});
      }
    })();
  }, [dispatch, topLevel, state.name, state.token]);

  const login = (name, token) => {
    console.log(`Logging in as ${name}`);
    dispatch({type: 'LOGIN', name, token});
  };

  const logout = () => {
    console.log('Logging out');
    dispatch({type: 'LOGOUT'});
  };

  return {...state, login, logout};
};

export const AuthProvider = ({children}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <AuthContext.Provider value={{...state, dispatch}}>{children}</AuthContext.Provider>;
};
