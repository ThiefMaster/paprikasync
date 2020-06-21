import flask from 'flask-urls.macro';
import React, {createContext, useCallback, useContext, useReducer} from 'react';
import {useHistory} from 'react-router-dom';
import {fetchJSON} from './fetch';
import {useNumericParam} from './router';

const StoreContext = createContext();

const initialState = {
  ownCategories: {},
  ownRecipes: null,
  partnerCategories: {},
  partnerRecipes: {},
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
    case 'SET_OWN_CATEGORIES':
      return {...state, ownCategories: flattenCategories(action.categories)};
    case 'SET_OWN_RECIPES':
      return {...state, ownRecipes: action.recipes};
    case 'SET_PARTNER_CATEGORIES':
      return {
        ...state,
        partnerCategories: {
          ...state.partnerCategories,
          [action.partner]: flattenCategories(action.categories),
        },
      };
    case 'SET_PARTNER_RECIPES':
      return {
        ...state,
        partnerRecipes: {
          ...state.partnerRecipes,
          [action.partner]: action.recipes,
        },
      };
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
  const history = useHistory();
  const selectedPartner = useNumericParam('partnerId');

  const loadCategories = useCallback(
    async (partner = undefined) => {
      const urlParams = partner ? {partner_id: partner} : {};
      const [code, resp] = await fetchJSON(flask`api.paprika_categories`(urlParams));
      if (code === 200) {
        dispatch({
          type: partner ? 'SET_PARTNER_CATEGORIES' : 'SET_OWN_CATEGORIES',
          categories: resp,
          partner,
        });
      }
    },
    [dispatch]
  );

  const loadRecipes = useCallback(
    async (partner = undefined) => {
      const urlParams = partner ? {partner_id: partner} : {};
      const [code, resp] = await fetchJSON(flask`api.paprika_recipes`(urlParams));
      if (code === 200) {
        dispatch({
          type: partner ? 'SET_PARTNER_RECIPES' : 'SET_OWN_RECIPES',
          recipes: resp,
          partner,
        });
      }
    },
    [dispatch]
  );

  const selectPartner = useCallback(
    partner => {
      const target = partner ? `/partner/${partner}/recipes/` : '/recipes/';
      if (history.location.pathname !== target) {
        history.push(target);
      }
    },
    [history]
  );

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

  const categories = selectedPartner
    ? state.partnerCategories[selectedPartner] || {}
    : state.ownCategories;

  const recipes = selectedPartner
    ? state.partnerRecipes[selectedPartner] || null
    : state.ownRecipes;

  const selectedPartnerName = selectedPartner
    ? (state.partners.find(p => p.id === selectedPartner) || {}).name
    : null;

  return {
    loadCategories,
    loadRecipes,
    selectPartner,
    loadActivePartners,
    loadPendingPartners,
    requestPartnership,
    deleteActivePartner,
    approvePendingPartner,
    deletePendingPartner,
    refreshPaprika,
    ...state,
    categories,
    recipes,
    selectedPartner,
    selectedPartnerName,
  };
};

export const StoreProvider = ({children}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return <StoreContext.Provider value={{...state, dispatch}}>{children}</StoreContext.Provider>;
};
