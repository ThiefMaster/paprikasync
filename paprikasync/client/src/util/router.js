import {useEffect} from 'react';
import {useLocation} from 'react-router-dom';

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
