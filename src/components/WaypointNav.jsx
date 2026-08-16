import { useState } from 'react';
import { WAYPOINTS } from '../lib/waypoints';

/**
 * Fast-travel buttons plus the guided tour toggle.
 *
 * DOM rather than 3D, like the other overlays: real buttons are focusable,
 * keyboard-operable and readable by assistive technology for free, none of which
 * is true of something drawn into the canvas.
 *
 * Collapsed by default on small screens. Six destinations plus a tour button is a
 * tall list, and on a phone it and the control legend together covered around
 * half the viewport - hiding the city, which is the thing people came for. The
 * tour button stays visible even when collapsed, because on touch it is the main
 * way to see the place without knowing any gestures.
 *
 * `activeId` marks the last destination chosen, not where the camera currently
 * is - the camera can be flown somewhere and then dragged away. Claiming
 * otherwise would need continuous position testing for no real benefit.
 */
export default function WaypointNav({ activeId, touring, onToggleTour, onSelect, compact }) {
  const [open, setOpen] = useState(!compact);

  return (
    <nav className={`waypoints${open ? '' : ' waypoints--closed'}`} aria-label="Jump to a location">
      <div className="waypoints__head">
        <h2 className="waypoints__heading">Locations</h2>
        {compact && (
          <button
            type="button"
            className="waypoints__collapse"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={open ? 'Hide locations' : 'Show locations'}
          >
            {open ? '−' : '+'}
          </button>
        )}
      </div>

      <button
        type="button"
        className={`waypoints__tour${touring ? ' is-running' : ''}`}
        onClick={onToggleTour}
        aria-pressed={touring}
      >
        <span aria-hidden="true">{touring ? '■' : '▶'}</span>
        <span>{touring ? 'Stop tour' : 'Play tour'}</span>
      </button>

      {open && (
        <ul className="waypoints__list">
          {WAYPOINTS.map((waypoint) => (
            <li key={waypoint.id}>
              <button
                type="button"
                className={`waypoints__item${activeId === waypoint.id ? ' is-active' : ''}`}
                onClick={() => onSelect(waypoint)}
              >
                <span className="waypoints__label">{waypoint.label}</span>
                <span className="waypoints__hint">{waypoint.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
