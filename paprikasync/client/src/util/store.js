import flask from 'flask-urls.macro';
import React, {createContext, useContext, useReducer, useCallback} from 'react';
import {fetchJSON} from './fetch';

const StoreContext = createContext();

const initialState = {
  categories: {},
  recipes: null,
  partners: [],
  pendingPartners: {incoming: [], outgoing: []},
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
    case 'SET_ACTIVE_PARTNERS':
      return {...state, partners: action.partners};
    case 'SET_PENDING_PARTNERS':
      return {...state, pendingPartners: action.partners};
    case 'SET_ALL_PARTNERS':
      return {...state, pendingPartners: action.pending, partners: action.active};
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

  const loadActivePartners = useCallback(async () => {
    const [code, resp] = await fetchJSON(flask`api.user_partners_active`());
    if (code === 200) {
      dispatch({type: 'SET_ACTIVE_PARTNERS', partners: resp});
    }
  }, [dispatch]);

  const loadPendingPartners = useCallback(async () => {
    const [code, resp] = await fetchJSON(flask`api.user_partners_pending`());
    if (code === 200) {
      dispatch({type: 'SET_PENDING_PARTNERS', partners: resp});
    }
  }, [dispatch]);

  const requestPartnership = useCallback(
    async partnerCode => {
      const [code, resp] = await fetchJSON(
        flask`api.user_partners_create_pending`(),
        {partner_code: partnerCode},
        'POST'
      );
      if (code !== 200) {
        return resp.error;
      }
      dispatch({type: 'SET_ALL_PARTNERS', active: resp.active, pending: resp.pending});
    },
    [dispatch]
  );

  const deleteActivePartner = useCallback(
    async userId => {
      const [code, resp] = await fetchJSON(
        flask`api.user_partners_delete_active`({user_id: userId}),
        null,
        'DELETE'
      );
      if (code === 200) {
        dispatch({type: 'SET_ACTIVE_PARTNERS', partners: resp});
      }
    },
    [dispatch]
  );

  const deletePendingPartner = useCallback(
    async userId => {
      const [code, resp] = await fetchJSON(
        flask`api.user_partners_delete_pending`({user_id: userId}),
        null,
        'DELETE'
      );
      if (code === 200) {
        dispatch({type: 'SET_PENDING_PARTNERS', partners: resp});
      }
    },
    [dispatch]
  );

  const approvePendingPartner = useCallback(
    async userId => {
      const [code, resp] = await fetchJSON(
        flask`api.user_partners_approve_pending`({user_id: userId}),
        null,
        'PUT'
      );
      if (code === 200) {
        dispatch({type: 'SET_ALL_PARTNERS', active: resp.active, pending: resp.pending});
      }
    },
    [dispatch]
  );

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

  return {
    loadCategories,
    loadRecipes,
    loadActivePartners,
    loadPendingPartners,
    requestPartnership,
    deleteActivePartner,
    approvePendingPartner,
    deletePendingPartner,
    refreshPaprika,
    ...state,
  };
};

export const StoreProvider = ({children}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <StoreContext.Provider value={{...state, dispatch}}>{children}</StoreContext.Provider>;
};
