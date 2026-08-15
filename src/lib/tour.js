/**
 * The guided tour: an ordered walk through the waypoints.
 *
 * Deliberately built on top of the existing waypoint flight rather than as a
 * separate camera system. A tour is just "fly to A, wait, fly to B, wait" - and
 * reusing the flight means the easing, the interruption handling and the
 * clearance-tested destinations all come for free.
 *
 * The order is chosen to tell a story rather than to minimise travel: start wide
 * so the viewer gets their bearings, pull back over the water for the skyline
 * silhouette, then work inward and downward, ending at ground level where the
 * texture detail is most obvious. Finally back to the overview so a looping tour
 * returns to a sensible resting frame.
 */
export const TOUR = [
  { id: 'overview', dwellMs: 2600 },
  { id: 'harbour', dwellMs: 3400 },
  { id: 'outer', dwellMs: 3000 },
  { id: 'core', dwellMs: 3000 },
  { id: 'peak', dwellMs: 3000 },
  { id: 'street', dwellMs: 3800 },
];

/*
 * Tour legs are much slower than a manual waypoint jump (1200ms).
 *
 * A click is a navigation - the user already knows where they want to be, so
 * getting there quickly is the priority. A tour leg is a shot: the travel IS the
 * content, and at 1200ms the city flicks past too fast to read. 3000ms lets the
 * parallax between near and far buildings actually register.
 */
export const TOUR_FLIGHT_MS = 3000;

/** Total run time, useful for the README and for sizing a demo recording. */
export const TOUR_DURATION_MS = TOUR.reduce(
  (total, leg) => total + TOUR_FLIGHT_MS + leg.dwellMs,
  0,
);
