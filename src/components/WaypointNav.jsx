import { WAYPOINTS } from '../lib/waypoints';

/**
 * Fast-travel buttons plus the guided tour toggle.
 *
 * DOM rather than 3D, like the other overlays: real buttons are focusable,
 * keyboard-operable and readable by assistive technology for free, none of which
 * is true of something drawn into the canvas.
 *
 * `activeId` is only a highlight. The camera can be flown somewhere and then
 * dragged away, so this marks the last destination chosen, not where the camera
 * currently is - claiming otherwise would need continuous position testing for no
 * real benefit. During the tour it tracks the current leg, which is accurate
 * because the tour is what is driving the camera.
 */
export default function WaypointNav({ activeId, touring, onToggleTour, onSelect }) {
  return (
    <nav className="waypoints" aria-label="Jump to a location">
      <h2 className="waypoints__heading">Locations</h2>

      <button
        type="button"
        className={`waypoints__tour${touring ? ' is-running' : ''}`}
        onClick={onToggleTour}
        // The label states what pressing it will DO, not what is happening now.
        aria-pressed={touring}
      >
        <span aria-hidden="true">{touring ? '■' : '▶'}</span>
        <span>{touring ? 'Stop tour' : 'Play tour'}</span>
      </button>

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
    </nav>
  );
}
