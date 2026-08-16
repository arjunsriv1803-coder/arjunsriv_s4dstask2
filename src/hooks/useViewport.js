import { useEffect, useState } from 'react';

/*
 * `compact` is deliberately about SIZE, not about touch.
 *
 * They are different questions and conflating them gets both wrong: a tablet has
 * touch and plenty of room, while a small laptop window has a mouse and very
 * little. Panel layout follows available space; the control legend follows input
 * method.
 */
const COMPACT_QUERY = '(max-width: 640px)';
const TOUCH_QUERY = '(pointer: coarse)';

const matches = (query) =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia(query).matches;

/**
 * Reports whether the viewport is small and whether the primary input is touch.
 *
 * Both are live: `compact` has to survive a device rotation, which changes the
 * width without reloading the page.
 */
export default function useViewport() {
  const [state, setState] = useState(() => ({
    compact: matches(COMPACT_QUERY),
    touch: matches(TOUCH_QUERY),
  }));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const compactList = window.matchMedia(COMPACT_QUERY);
    const touchList = window.matchMedia(TOUCH_QUERY);

    const update = () =>
      setState({ compact: compactList.matches, touch: touchList.matches });

    compactList.addEventListener('change', update);
    touchList.addEventListener('change', update);
    return () => {
      compactList.removeEventListener('change', update);
      touchList.removeEventListener('change', update);
    };
  }, []);

  return state;
}
