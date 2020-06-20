import {useEffect, useRef} from 'react';

/**
 * React hook to use `setTimeout` inside a react component.
 *
 * @param {Function} callback - the function to run at the end
 * @param {Number} delay - the duration of the timeout (`null` to disable)
 *
 * Based on https://overreacted.io/making-setinterval-declarative-with-react-hooks/
 */
export function useTimeout(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the actual timeout
  useEffect(() => {
    if (delay !== null) {
      const id = setTimeout(() => savedCallback.current(), delay);
      return () => clearTimeout(id);
    }
  }, [delay]);
}
