import { useState } from 'react';

const CONTROLS = [
  ['Drag', 'Orbit'],
  ['Scroll', 'Zoom'],
  ['W A S D', 'Move'],
  ['Q / E', 'Down / Up'],
  ['Shift', 'Faster'],
  ['R', 'Reset view'],
];

/**
 * Persistent control legend.
 *
 * A 3D scene with hidden keyboard controls is a scene most people will only ever
 * drag. Collapsible because it is reference material, not something to read twice
 * - and because it would otherwise sit on top of the city in every screenshot.
 */
export default function ControlsOverlay() {
  const [open, setOpen] = useState(true);

  return (
    <div className={`controls${open ? '' : ' controls--closed'}`}>
      <button
        type="button"
        className="controls__toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span>Controls</span>
        <span className="controls__chevron" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <dl className="controls__list">
          {CONTROLS.map(([key, action]) => (
            <div className="controls__row" key={key}>
              <dt>
                <kbd>{key}</kbd>
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
