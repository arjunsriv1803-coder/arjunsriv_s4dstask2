import { useEffect, useRef } from 'react';

/*
 * Tracks which movement keys are currently held.
 *
 * The important detail: pressed keys live in a Set inside a ref, NOT in React
 * state. Holding W fires keydown repeatedly, and a setState per event would
 * re-render the whole component tree dozens of times a second while the camera
 * is already re-rendering every frame anyway. A ref mutates in place and the
 * render loop simply reads the current contents each frame.
 *
 * Returns the ref itself so the caller reads `keys.current` inside useFrame.
 */
export default function useFlyControls() {
  const keys = useRef(new Set());

  useEffect(() => {
    // e.code, not e.key: code is the physical key position, so WASD keeps working
    // on AZERTY/Dvorak layouts and is unaffected by whether Shift is held.
    const onKeyDown = (event) => {
      // Space and the arrow keys scroll the page by default. The canvas fills the
      // viewport so there is nothing to scroll, but the browser still fires it.
      if (event.code === 'Space') event.preventDefault();
      keys.current.add(event.code);
    };

    const onKeyUp = (event) => {
      keys.current.delete(event.code);
    };

    /*
     * Without this, alt-tabbing away mid-flight is a bug: the keyup never arrives
     * because the window no longer has focus, the key stays in the Set, and the
     * camera drifts forever once you come back. Clearing on blur fixes it.
     */
    const onBlur = () => keys.current.clear();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return keys;
}
