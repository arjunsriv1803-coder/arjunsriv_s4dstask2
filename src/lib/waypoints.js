/**
 * Fast-travel destinations.
 *
 * PROVENANCE - worth knowing before renaming any of these.
 *
 * The model carries no landmark data: its meshes are Object_0..Object_14 under a
 * single material, so nothing in the file knows where anything is. Its footprint
 * is also 676 x 1000 world units, a ratio of about 1.5:1, whereas Manhattan is
 * roughly 6:1 - this is a cropped tile, not the whole island. Labelling these
 * "Midtown" or "Battery Park" would therefore be inventing geography that cannot
 * be checked, so every destination below is named for a measured feature instead.
 *
 * Coordinates come from a height-and-density analysis of the geometry: the world
 * was divided into a grid and each cell's peak and mean height measured. The
 * numbers in the comments are those measurements.
 *
 * Each entry gives the point to LOOK AT, the direction to view it from, and how
 * far back to sit. The camera position is derived from those, so adjusting a shot
 * means changing one number rather than re-deriving a position by hand.
 */

export const WAYPOINTS = [
  {
    id: 'overview',
    label: 'Overview',
    hint: 'The whole city',
    // Special-cased: recomputed from the model's bounds and the current aspect
    // ratio, so it matches the opening shot on any window size.
    useFraming: true,
  },
  {
    id: 'core',
    label: 'Skyline Core',
    hint: 'Densest high-rise',
    // Grid cell x -141, z 42: mean height 91, peak 181 - the highest average in
    // the model, so the most consistently built-up block rather than one spike.
    target: [-141, 90, 42],
    direction: [0.85, 0.5, 0.8],
    distance: 400,
  },
  {
    id: 'peak',
    label: 'Tallest Tower',
    hint: 'Highest structure',
    // Peak vertex measured at x -87, y 187, z 66.
    target: [-87, 120, 66],
    direction: [1, 0.34, 0.9],
    distance: 270,
  },
  {
    id: 'outer',
    label: 'Outer Cluster',
    hint: 'Far-side towers',
    // Grid cell x -197, z 208: peak 186, nearly matching the tallest, but well
    // separated from the core - gives a genuinely different view.
    target: [-197, 95, 208],
    direction: [0.9, 0.45, 0.6],
    distance: 360,
  },
  {
    id: 'harbour',
    label: 'Harbour Approach',
    hint: 'From the water',
    // Out over open water looking back, so the whole skyline reads against the
    // sky. Also the shot that shows the fog and the ocean doing their job.
    target: [-100, 70, 0],
    direction: [1, 0.26, -1],
    distance: 640,
  },
  {
    id: 'street',
    label: 'Street Level',
    hint: 'Down among the blocks',
    // Terrain sits at 33-47, so a target at 50 with a shallow approach puts the
    // camera just above street height. This is the shot that shows the 2048
    // texture at close range.
    target: [-120, 52, 30],
    direction: [1, 0.13, 0.62],
    distance: 130,
  },
];

/** Duration of the camera flight, in milliseconds. */
export const FLIGHT_MS = 1200;

/**
 * Ease in and out.
 *
 * A linear tween starts and stops abruptly and reads as a machine moving the
 * camera. Easing both ends makes it read as a deliberate move, which is most of
 * why a 1.2s flight feels better than an instant cut.
 */
export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
