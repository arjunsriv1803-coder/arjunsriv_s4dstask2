import { WAYPOINTS } from '../lib/waypoints';

/**
 * Fast-travel buttons.
 *
 * DOM rather than 3D, like the other overlays: real buttons are focusable,
 * keyboard-operable and readable by assistive technology for free, none of which
 * is true of something drawn into the canvas.
 *
 * `activeId` is only a highlight. The camera can be flown somewhere and then
 * dragged away, so this marks the last destination chosen, not where the camera
 * currently is - claiming otherwise would need continuous position testing for
 * no real benefit.
 */
export default function WaypointNav({ activeId, onSelect }) {
  return (
    <nav className="waypoints" aria-label="Jump to a location">
      <h2 className="waypoints__heading">Locations</h2>
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
