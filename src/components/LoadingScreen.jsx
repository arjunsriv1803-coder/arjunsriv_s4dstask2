import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

const FADE_MS = 600;

/**
 * Full-screen loading overlay.
 *
 * A blank page for several seconds reads as broken, and the model is the single
 * largest thing the app fetches. useProgress reports against three's loading
 * manager, so this tracks the real decode-and-upload progress of the GLB rather
 * than a fake timer.
 *
 * Lives outside the Canvas as plain DOM. Rendering it as 3D content would be
 * pointless - it needs to be visible precisely when the 3D scene is not ready.
 */
export default function LoadingScreen() {
  const { progress, active } = useProgress();

  const [mounted, setMounted] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // `active` goes false when the loading manager has nothing in flight. Both
    // conditions are checked because progress briefly reads 100 between items.
    if (active || progress < 100) return;

    setFading(true);
    // Unmount only after the fade finishes, so the overlay is not removed
    // mid-transition and does not keep a full-screen element in the tree forever.
    const timer = setTimeout(() => setMounted(false), FADE_MS);
    return () => clearTimeout(timer);
  }, [active, progress]);

  if (!mounted) return null;

  const rounded = Math.round(progress);

  return (
    <div
      className={`loading${fading ? ' loading--done' : ''}`}
      // aria-hidden once it is on its way out, so a screen reader does not
      // announce a loading state the user is no longer waiting on.
      aria-hidden={fading}
    >
      <div className="loading__panel">
        <h1 className="loading__title">Manhattan</h1>
        <p className="loading__subtitle">Interactive 3D city</p>

        <div
          className="loading__track"
          role="progressbar"
          aria-valuenow={rounded}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading city model"
        >
          {/* Width is inline because it changes every frame - putting a moving
              value in a stylesheet class would mean churning CSS rules. */}
          <div className="loading__fill" style={{ width: `${progress}%` }} />
        </div>

        <div className="loading__meta">
          <span>{rounded}%</span>
          <span className="loading__hint">Drag to orbit &middot; WASD to fly &middot; R to reset</span>
        </div>
      </div>
    </div>
  );
}
