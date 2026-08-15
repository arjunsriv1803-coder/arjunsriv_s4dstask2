import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import CityModel, { TARGET_SPAN } from './CityModel';

/*
 * Positions the camera so the whole city is in frame on first paint.
 *
 * This is deliberately computed rather than hardcoded. "Model does not appear" is
 * the single most common failure when wiring up a GLB, and it is almost always
 * because the camera is 200 units away from something 8 units wide, or parked
 * inside a building. Deriving the distance from the model's known world span and
 * the camera's actual field of view removes that whole class of bug.
 */
function AutoFrame() {
  const camera = useThree((state) => state.camera);
  // OrbitControls registers itself here because of its `makeDefault` prop. It is
  // null on the first render, so this effect re-runs once it exists.
  const controls = useThree((state) => state.controls);

  useEffect(() => {
    const radius = TARGET_SPAN * 0.5;
    const verticalFov = (camera.fov * Math.PI) / 180;

    // Distance that fits `radius` vertically. On a portrait/narrow window the
    // horizontal axis becomes the tighter constraint, so widen by the aspect.
    const fitVertical = radius / Math.tan(verticalFov / 2);
    const fitHorizontal = fitVertical / Math.min(1, camera.aspect);
    const distance = Math.max(fitVertical, fitHorizontal) * 1.15; // 15% breathing room

    // A 3/4 view reads as a city far better than a straight-on or top-down one.
    const direction = new Vector3(1, 0.62, 1).normalize();
    camera.position.copy(direction.multiplyScalar(distance));

    // Aim slightly above ground level so the horizon sits in the upper third.
    const target = new Vector3(0, TARGET_SPAN * 0.04, 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    if (controls) {
      controls.target.copy(target);
      controls.update();
    }

    console.info(
      '[AutoFrame] camera',
      camera.position.toArray().map((n) => Math.round(n)),
      `distance ${Math.round(distance)}`,
    );
  }, [camera, controls]);

  return null;
}

export default function CityScene() {
  return (
    <>
      {/* Ambient fills the shadowed sides so unlit faces are readable rather than
          black. Directional gives the buildings a consistent sun direction, which
          is what actually makes the massing legible. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={1.5} />

      <CityModel />

      {/* makeDefault publishes these controls on the R3F state so other components
          (AutoFrame now, the fly rig in the next step) can read and move the target. */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        // Just under a right angle, so the user cannot orbit under the ground and
        // end up looking at the city from below through the back faces.
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
      <AutoFrame />
    </>
  );
}
