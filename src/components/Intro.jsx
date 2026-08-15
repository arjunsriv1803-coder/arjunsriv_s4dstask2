import { useCallback, useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

const FADE_MS = 600;

/*
 * Phases:
 *   welcome  - title card; also the loading screen
 *   tour     - offer the guided tour
 *   leaving  - fading out, input ignored
 *   gone     - unmounted
 */
const WELCOME = 'welcome';
const TOUR = 'tour';
const LEAVING = 'leaving';
const GONE = 'gone';

/**
 * Title card, loading screen and tour prompt in one overlay.
 *
 * These are deliberately the same component rather than a landing page stacked on
 * top of a separate loader. The model is an 11 MB download, and hiding that
 * behind a bare progress bar means the user spends the wait watching a bar. Here
 * the wait is spent reading the title card instead, and the "Press Enter" prompt
 * simply appears once loading finishes - so the perceived load time is however
 * long it takes to read one line, rather than however long the network took.
 *
 * Enter is gated on the model actually being ready. Letting someone in early
 * would drop them onto an empty canvas, which is a worse first impression than a
 * brief wait.
 */
export default function Intro({ onStart }) {
  const { progress, active } = useProgress();

  /*
   * Guard against a warm cache.
   *
   * useGLTF.preload starts the download when the module is parsed, so on a repeat
   * visit the model can be fully loaded before this component ever mounts. The
   * loading manager then reports nothing in flight and no progress, and the naive
   * `progress >= 100` check would never become true - leaving the user stuck on a
   * title card with a dead Enter key.
   *
   * So: if nothing is loading AND progress has not moved at all, after a short
   * grace period conclude there is nothing to wait for.
   */
  const [assumeReady, setAssumeReady] = useState(false);
  useEffect(() => {
    if (active || progress > 0) return undefined;
    const timer = setTimeout(() => setAssumeReady(true), 1200);
    return () => clearTimeout(timer);
  }, [active, progress]);

  const ready = assumeReady || (!active && progress >= 100);

  const [phase, setPhase] = useState(WELCOME);

  /*
   * Leaves the overlay and reports the choice AFTER the fade.
   *
   * The delay is not only cosmetic. The tour is stopped by any keypress, and
   * starting it in the same tick as the Enter that confirmed it risks the key
   * repeat immediately cancelling it. By the time the fade finishes that event is
   * long gone.
   */
  const finish = useCallback(
    (wantsTour) => {
      setPhase(LEAVING);
      setTimeout(() => {
        setPhase(GONE);
        onStart(wantsTour);
      }, FADE_MS);
    },
    [onStart],
  );

  useEffect(() => {
    if (phase === LEAVING || phase === GONE) return undefined;

    const onKeyDown = (event) => {
      // Key repeat would otherwise fire the same choice several times.
      if (event.repeat) return;

      if (phase === WELCOME) {
        if (event.key === 'Enter' && ready) {
          event.preventDefault();
          setPhase(TOUR);
        }
        return;
      }

      if (event.key === 'Enter' || event.key.toLowerCase() === 'y') {
        event.preventDefault();
        finish(true);
      } else if (event.key === 'Escape' || event.key.toLowerCase() === 'n') {
        event.preventDefault();
        finish(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, ready, finish]);

  if (phase === GONE) return null;

  const rounded = Math.round(progress);

  return (
    <div
      className={`intro${phase === LEAVING ? ' intro--leaving' : ''}`}
      // Once it is on its way out a screen reader should not announce it.
      aria-hidden={phase === LEAVING}
    >
      <div className="intro__panel">
        <p className="intro__eyebrow">Interactive 3D</p>
        <h1 className="intro__title">Welcome to Manhattan</h1>

        {phase === WELCOME ? (
          <>
            <p className="intro__lede">
              A photogrammetry scan of Lower Manhattan, optimised from 519&nbsp;MB down to
              11&nbsp;MB so it runs in a browser tab.
            </p>

            <div
              className="intro__track"
              role="progressbar"
              aria-valuenow={rounded}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Loading city model"
            >
              {/* Inline because it changes every frame; a moving value does not
                  belong in a stylesheet rule. */}
              <div className="intro__fill" style={{ width: `${progress}%` }} />
            </div>

            <div className="intro__status">
              {ready ? (
                <button type="button" className="intro__enter" onClick={() => setPhase(TOUR)}>
                  Press <kbd>Enter</kbd> to begin
                </button>
              ) : (
                <span className="intro__loading">Loading the city… {rounded}%</span>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="intro__lede">
              Would you like a guided tour? It flies you through six viewpoints in about
              forty seconds. You can take control at any moment.
            </p>

            <div className="intro__choices">
              <button
                type="button"
                className="intro__choice intro__choice--primary"
                onClick={() => finish(true)}
                autoFocus
              >
                Yes, show me around
                <span className="intro__key">Enter</span>
              </button>
              <button type="button" className="intro__choice" onClick={() => finish(false)}>
                No, let me explore
                <span className="intro__key">Esc</span>
              </button>
            </div>
          </>
        )}

        <p className="intro__hint">Drag to orbit · WASD to fly · R to reset</p>
      </div>
    </div>
  );
}
