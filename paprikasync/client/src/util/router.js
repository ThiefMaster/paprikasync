import {useEffect} from 'react';
import {useLocation, useParams} from 'react-router-dom';

const scrollPositions = {};

export const useRestoreScroll = (ready = true) => {
  const {key} = useLocation();

  useEffect(() => {
    if (!ready) {
      return;
    }

    const lastPosition = scrollPositions[key];
    if (lastPosition) {
      window.scrollTo(lastPosition.x, lastPosition.y);
    } else {
      window.scrollTo(0, 0);
    }

    return () => {
      scrollPositions[key] = {x: window.scrollX, y: window.scrollY};
    };
  }, [ready, key]);
};

export const useNumericParam = name => {
  const params = useParams();
  const param = params[name];
  return param !== undefined ? parseInt(param, 10) : null;
};
