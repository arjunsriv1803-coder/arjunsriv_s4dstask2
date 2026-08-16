import { useState } from 'react';

/*
 * Two legends, because the two input methods share almost nothing.
 *
 * Listing "W A S D" on a phone is worse than listing nothing: it advertises
 * controls the device cannot produce, and buries the gestures that do work.
 */
const POINTER_CONTROLS = [
  ['Drag', 'Orbit'],
  ['Scroll', 'Zoom'],
  ['W A S D', 'Move'],
  ['Q / E', 'Down / Up'],
  ['Shift', 'Faster'],
  ['R', 'Reset view'],
];

const TOUCH_CONTROLS = [
  ['Drag', 'Orbit'],
  ['Pinch', 'Zoom'],
  ['Two fingers', 'Pan'],
];

/**
 * Control legend.
 *
 * Collapsed by default on small screens: on a phone this panel and the Locations
 * list together covered around half the viewport, which is a poor trade for
 * reference material you read once.
 */
export default function ControlsOverlay({ touch, compact }) {
  const [open, setOpen] = useState(!compact);
  const controls = touch ? TOUCH_CONTROLS : POINTER_CONTROLS;

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
          {controls.map(([key, action]) => (
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
