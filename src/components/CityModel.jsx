import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { CITY_GROUP_NAME, TARGET_SPAN, computeMeshBounds } from '../lib/city';

const MODEL_URL = '/models/manhattan_optimized.glb';

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
   * Normalise the model: centre it horizontally on its own mesh bounds, sit it on
   * y=0, and scale it to TARGET_SPAN. Deriving this from the measured bounding box
   * rather than hardcoded numbers means the scene still frames correctly if the
   * asset is ever re-exported at a different scale.
   */
  const fit = useMemo(() => {
    // Mesh-only bounds: see computeMeshBounds. Using full scene bounds would
    // centre the city on geometry (the LINES primitive) that is not the city.
    const box = computeMeshBounds(scene) ?? new Box3().setFromObject(scene);
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
    };
  }, [scene]);

  useLayoutEffect(() => {
    scene.traverse((object) => {
      if (!object.isMesh) return;

      // Assert rather than assume. Frustum culling is what stops the GPU shading
      // the parts of the city that are behind the camera on every frame.
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
    const box = computeMeshBounds(scene);
    if (!box) return;
    const size = box.getSize(new Vector3());
    console.info(
      '[CityModel] source mesh bbox',
      {
        min: box.min.toArray().map((n) => +n.toFixed(3)),
        max: box.max.toArray().map((n) => +n.toFixed(3)),
        size: size.toArray().map((n) => +n.toFixed(3)),
      },
      `-> scale x${fit.scale.toFixed(2)} -> world span ${TARGET_SPAN}`,
    );
  }, [scene, fit]);

  return (
    // Named so CameraRig can look the city up in the scene graph and frame the
    // camera against its real world bounds, rather than assuming it sits at the
    // origin. Avoids threading refs or a store through the tree for one value.
    <group name={CITY_GROUP_NAME} scale={fit.scale}>
      <primitive object={scene} position={fit.offset} />
    </group>
  );
}

// Start fetching the model as soon as this module is parsed, rather than waiting
// for React to mount the component. Costs nothing and shaves the wait.
useGLTF.preload(MODEL_URL, false, true);
