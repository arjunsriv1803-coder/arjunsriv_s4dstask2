import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';

const MODEL_URL = '/models/manhattan_optimized.glb';

/*
 * The source model measures roughly 8 x 2 x 12 in its own units. Working at that
 * scale is painful: a sensible camera near-plane (1) would clip straight through
 * the city, and any movement speed would need awkward fractional values.
 *
 * So we rescale once, on load, to a known world span. Every other tuned number in
 * the project - near/far, fog distances, fly speed - is then expressed against
 * this constant and actually means something.
 */
const TARGET_SPAN = 1000;

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
const WATER_LEVEL = TARGET_SPAN * 0.038;

export default function CityModel() {
  /*
   * Argument 2 is `useDraco`, argument 3 is `useMeshopt`.
   *
   * useMeshopt MUST stay true. The optimized GLB lists EXT_meshopt_compression in
   * extensionsRequired, so without the decoder registered the loader throws and
   * nothing renders at all - the vertex data is compressed, not merely packed.
   *
   * useDraco is explicitly false. drei defaults it to true, which attaches a
   * DRACOLoader pointing at a Google CDN. Our model carries no Draco data so that
   * decoder would never run, but disabling it removes a third-party origin from
   * the app for free.
   */
  const { scene } = useGLTF(MODEL_URL, false, true);

  /*
   * Normalise the model: centre it horizontally on the origin, sit it on y=0, and
   * scale it to TARGET_SPAN. Doing this from the measured bounding box rather than
   * a hardcoded number means the scene still frames correctly if the asset is
   * ever re-exported at a different scale.
   */
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    // Scale on the larger horizontal axis. Using height instead would make a tall,
    // narrow model fill the screen vertically and vanish to a sliver.
    const span = Math.max(size.x, size.z);
    const scale = TARGET_SPAN / span;

    return {
      scale,
      // Offsets are applied INSIDE the scaled group, so they are in source units.
      // -center.x/-center.z centres it; -box.min.y drops its base onto the ground.
      offset: [-center.x, -box.min.y, -center.z],
      // Post-scale dimensions, which is what the camera rig needs to frame it.
      scaledSize: size.clone().multiplyScalar(scale),
    };
  }, [scene]);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (!object.isMesh) return;

      // Assert rather than assume. Frustum culling is what stops the GPU shading
      // the two-thirds of the city that is behind the camera on every frame.
      object.frustumCulled = true;

      // Shadows are off at the Canvas level, so leaving these true would have the
      // renderer walking the shadow path for meshes that never cast anything.
      object.castShadow = false;
      object.receiveShadow = false;
    });
  }, [scene]);

  // Bounding box logging - the single most useful diagnostic when a model does not
  // appear. If the city is invisible it is nearly always scale or position, and
  // these numbers say which immediately.
  useLayoutEffect(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    console.info(
      '[CityModel] source bbox',
      {
        min: box.min.toArray().map((n) => +n.toFixed(3)),
        max: box.max.toArray().map((n) => +n.toFixed(3)),
        size: size.toArray().map((n) => +n.toFixed(3)),
      },
      `-> scale x${fit.scale.toFixed(2)} -> world span ${TARGET_SPAN}`,
    );
  }, [scene, fit]);

  return (
    <group scale={fit.scale}>
      <primitive object={scene} position={fit.offset} />
    </group>
  );
}

// Start fetching the 7.6 MB model as soon as this module is parsed, rather than
// waiting for React to mount the component. Costs nothing and shaves the wait.
useGLTF.preload(MODEL_URL, false, true);

export { TARGET_SPAN, WATER_LEVEL };
