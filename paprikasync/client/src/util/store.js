import flask from 'flask-urls.macro';
import React, {createContext, useContext, useReducer, useCallback} from 'react';
import {fetchJSON} from './fetch';

const StoreContext = createContext();

const initialState = {
  categories: {},
  recipes: null,
};

const flattenCategories = categories =>
  categories.reduce((acc, cat) => {
    acc[cat.uid] = cat.name;
    return cat.children.length ? {...acc, ...flattenCategories(cat.children)} : acc;
  }, {});

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_CATEGORIES':
      return {...state, categories: flattenCategories(action.categories)};
    case 'SET_RECIPES':
      return {...state, recipes: action.recipes};
    default:
      return state;
  }
};

export const useStore = () => {
  const {dispatch, ...state} = useContext(StoreContext);

  const loadCategories = useCallback(async () => {
    const [code, resp] = await fetchJSON(flask`api.paprika_categories`());
    if (code === 200) {
      dispatch({type: 'SET_CATEGORIES', categories: resp});
    }
  }, [dispatch]);

  const loadRecipes = useCallback(async () => {
    const [code, resp] = await fetchJSON(flask`api.paprika_recipes`());
    if (code === 200) {
      dispatch({type: 'SET_RECIPES', recipes: resp});
    }
  }, [dispatch]);

  const refreshPaprika = useCallback(async () => {
    const [code, resp] = await fetchJSON(flask`api.user_refresh_paprika`(), {});
    if (code === 200) {
      if (resp.categories) {
        loadCategories();
      }
      if (resp.recipes || resp.photos) {
        loadRecipes();
      }
    }
  }, [loadCategories, loadRecipes]);

  return {loadCategories, loadRecipes, refreshPaprika, ...state};
};

export const StoreProvider = ({children}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <StoreContext.Provider value={{...state, dispatch}}>{children}</StoreContext.Provider>;
};
