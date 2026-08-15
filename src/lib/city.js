import { Box3 } from 'three';

/*
 * Shared facts about the city model.
 *
 * These live in their own module rather than alongside a component because a file
 * that exports both components and plain values breaks Vite's Fast Refresh - it
 * can no longer tell whether a change should hot-swap a component or reload the
 * module graph.
 */

/*
 * The source model measures roughly 8 x 2.3 x 11.9 in its own units. Working at
 * that scale is painful: a sensible camera near-plane would clip straight through
 * the city, and movement speeds would need awkward fractional values.
 *
 * So we rescale once, on load, to a known world span. Every other tuned number in
 * the project - near/far, fog distances, fly speed, the waterline - is expressed
 * against this constant and therefore actually means something.
 */
export const TARGET_SPAN = 1000;

/*
 * Height of the water surface, in world units above the model's base.
 *
 * Measured, not guessed. Bucketing triangle area by height shows the island's
 * terrain and street level concentrated between 33 and 47 units - 36% of the
 * model's entire surface area sits in that band - with only 3.2% below it. That
 * sparse lower region is the hollow underside and the vertical cut edge of the
 * tile, which is exactly what the water needs to hide. 38 sits inside the terrain
 * band, so low ground is submerged and the island reads as surrounded by water.
 */
export const WATER_LEVEL = TARGET_SPAN * 0.038;

/** Scene-graph name used by CameraRig to locate the city for framing. */
export const CITY_GROUP_NAME = 'city';

/**
 * Bounding box of an object's MESHES only.
 *
 * Box3.setFromObject() would be the obvious choice, but it includes every
 * drawable child - and this model ships a LINES primitive (Object_0, 1,619
 * segments) alongside the 14 building meshes. Those line segments extend past the
 * visible city, so including them pushes the computed centre away from the city's
 * actual visual mass, which is what made the island sit off-centre in frame.
 *
 * Returns null if the object contains no meshes at all.
 */
export function computeMeshBounds(root) {
  const box = new Box3();
  const childBox = new Box3();
  let found = false;

  // World matrices must be current or every child box lands in the wrong place.
  root.updateWorldMatrix(true, true);

  root.traverse((child) => {
    // isMesh is false for Line/LineSegments, which is exactly the filter we want.
    if (!child.isMesh || !child.geometry) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    childBox.copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld);
    box.union(childBox);
    found = true;
  });

  return found ? box : null;
}
