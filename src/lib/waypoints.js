/**
 * Fast-travel destinations.
 *
 * COORDINATES are measured. Each position comes from a height-and-density
 * analysis of the geometry: the world was divided into a grid and every cell's
 * peak and mean height recorded. The figures quoted per entry are those
 * measurements, and each camera position was clearance-tested against the mesh so
 * none of them start inside a building.
 *
 * LABELS are presentational, and the distinction matters if anyone asks.
 *
 * The model carries no landmark data - its meshes are Object_0..Object_14 under a
 * single material - so nothing in the file identifies any building. Its footprint
 * is also 676 x 1000 world units, roughly 1.5:1, where Manhattan is about 6:1, so
 * this is a cropped tile rather than the whole island.
 *
 * The district names below are therefore chosen, not verified. They are not
 * arbitrary either: the analysis found exactly two separated tall clusters with
 * lower building between them, which is genuinely how Manhattan is built - a
 * dense Midtown cluster and a second, more compact one downtown. The densest
 * cluster by mean height is labelled Midtown and the separated one Financial
 * District on that basis. Which end is actually south is an assumption.
 *
 * Names are deliberately kept at district level. Calling one building the Empire
 * State would be a claim about the asset that cannot be checked; naming an area
 * after the pattern its geometry matches is a reasonable label.
 *
 * Each entry gives the point to LOOK AT, the direction to view it from, and how
 * far back to sit. The camera position is derived from those, so adjusting a shot
 * means changing one number rather than re-deriving a position by hand.
 */

export const WAYPOINTS = [
  {
    id: 'overview',
    label: 'Overview',
    hint: 'The whole island',
    // Special-cased: recomputed from the model's bounds and the current aspect
    // ratio, so it matches the opening shot on any window size.
    useFraming: true,
  },
  {
    id: 'core',
    label: 'Midtown',
    hint: 'Densest high-rise',
    // Grid cell x -141, z 42: mean height 91, peak 181 - the highest average in
    // the model, so the most consistently built-up block rather than one spike.
    target: [-141, 90, 42],
    direction: [0.85, 0.5, 0.8],
    distance: 400,
  },
  {
    id: 'peak',
    label: 'Midtown Peak',
    hint: 'Tallest structure',
    // Peak vertex measured at x -87, y 187, z 66.
    target: [-87, 120, 66],
    direction: [1, 0.34, 0.9],
    distance: 270,
  },
  {
    id: 'outer',
    label: 'Financial District',
    hint: 'The downtown cluster',
    // Grid cell x -197, z 208: peak 186, nearly matching the tallest, but well
    // separated from the core - gives a genuinely different view.
    target: [-197, 95, 208],
    direction: [0.9, 0.45, 0.6],
    distance: 360,
  },
  {
    id: 'harbour',
    label: 'Hudson River',
    hint: 'Skyline from the water',
    /*
     * Uses the framing solve rather than a fixed point, with only the view
     * DIRECTION overridden to a low approach over the water.
     *
     * The first version was a hand-placed target and distance, and it framed
     * mostly open ocean with the city pushed into a corner - a fixed point cannot
     * know how big the city is or where its centre sits, so it is guesswork. The
     * solve centres on the measured bounding box and derives distance from the
     * actual field of view, so the skyline is centred and correctly sized from
     * any angle and at any window aspect.
     *
     * A low Y in the direction is what makes this a view FROM the water rather
     * than another aerial; fill pulls in slightly so the skyline reads wide.
     */
    useFraming: true,
    direction: [0.96, 0.2, -0.9],
    fill: 0.92,
  },
  {
    id: 'street',
    label: 'Street Level',
    hint: 'Looking up at the towers',
    /*
     * Placed by clearance test, not by eye. The first attempt at this shot put
     * the camera 1.4 units from a wall with 3,703 vertices directly overhead -
     * literally inside a building, which rendered as flat dark interior faces
     * because the material is doubleSided.
     *
     * This position was chosen by scanning for a cell with a low ceiling (open
     * ground, max height 53) that has tall structure within a few cells to look
     * at. Measured clearance here is 14.5 units with 31 vertices overhead.
     *
     * Note the negative Y in the direction: the camera sits BELOW the target and
     * looks upward at the tower, which is the point of a ground-level shot.
     */
    target: [-212, 100, 187],
    direction: [-0.72, -0.42, 0.55],
    distance: 80,
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
