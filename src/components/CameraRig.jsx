import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import useFlyControls from '../hooks/useFlyControls';
import {
  CITY_GROUP_NAME,
  TARGET_SPAN,
  WATER_LEVEL,
  computeMeshBounds,
} from '../lib/city';

/*
 * Movement speed as a fraction of the city's span, not an absolute number. If the
 * model is ever re-exported at a different scale, TARGET_SPAN keeps everything in
 * proportion and the controls still feel the same.
 */
const BASE_SPEED = TARGET_SPAN * 0.32; // world units per second
const BOOST_MULTIPLIER = 3;

/*
 * Fraction of the viewport the city should occupy when framed.
 *
 * These are used as real constraints, not fudge factors: the distance is solved
 * so the model's projected width hits FRAME_FILL_WIDTH, then checked against
 * FRAME_FILL_HEIGHT so a tall or portrait window never crops the skyline.
 */
const FRAME_FILL_WIDTH = 0.7;
const FRAME_FILL_HEIGHT = 0.78;

// Viewing direction. A 3/4 view reads as a city far better than straight-on.
const VIEW_DIRECTION = [1, 0.62, 1];

/*
 * Floor for both the camera and the orbit target, set just above the water. The
 * model is a cut-out tile with a hollow underside, so dropping below the surface
 * reveals the hole. maxPolarAngle stops orbiting under it; this stops FLYING
 * under it. The two guards are independent because either alone leaves a way
 * through.
 */
const MIN_HEIGHT = WATER_LEVEL + TARGET_SPAN * 0.008;

/*
 * How far the orbit target may stray from the city centre. Without this you can
 * fly indefinitely into empty ocean and lose the city entirely, with no obvious
 * way back short of pressing R.
 */
const MAX_TARGET_RADIUS = TARGET_SPAN * 0.85;

export default function CameraRig() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const scene = useThree((state) => state.scene);
  const keys = useFlyControls();

  // Where the city actually is, captured when it is first framed. The roaming
  // limit is measured from here rather than from the origin.
  const cityCenter = useRef(new Vector3());

  // Scratch vectors, allocated once. Creating Vector3s inside useFrame would mean
  // thousands of throwaway objects per second for the garbage collector to clean
  // up, which shows as periodic frame-time spikes.
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const move = useRef(new Vector3());

  /*
   * Frames the camera on the city's actual bounding box.
   *
   * Everything here is solved from the measured box rather than assumed: the
   * target is the box's centre (NOT the origin - the model is centred on its mesh
   * bounds, and aiming at the origin near water level left the city sitting low in
   * frame), and the distance is solved so the box's PROJECTED extent fills the
   * requested fraction of the viewport.
   *
   * Returns false if the model is not in the scene graph yet, so the caller can
   * retry on a later frame.
   */
  const frameCity = useCallback(() => {
    if (!controls) return false;

    const city = scene.getObjectByName(CITY_GROUP_NAME);
    if (!city) return false;

    const box = computeMeshBounds(city);
    if (!box) return false;

    const center = box.getCenter(new Vector3());
    const half = box.getSize(new Vector3()).multiplyScalar(0.5);

    const direction = new Vector3(...VIEW_DIRECTION).normalize();

    /*
     * Screen axes for this view. `right` is horizontal and perpendicular to the
     * view direction; `up` completes the frame. Projecting the box onto these
     * gives its true on-screen extent, which is what "fills 70% of the width"
     * actually means - a bounding SPHERE would badly overestimate a city that is
     * wide and flat rather than round.
     */
    const right = new Vector3(direction.z, 0, -direction.x).normalize();
    const up = new Vector3().crossVectors(right, direction).normalize();

    // Extent of an axis-aligned box along an arbitrary axis is the dot product of
    // its half-extents with the absolute components of that axis.
    const extentAlong = (axis) =>
      Math.abs(half.x * axis.x) + Math.abs(half.y * axis.y) + Math.abs(half.z * axis.z);

    const tanHalfFov = Math.tan(((camera.fov * Math.PI) / 180) / 2);

    // Distance at which each axis exactly hits its requested fill fraction.
    const distanceForWidth =
      extentAlong(right) / (FRAME_FILL_WIDTH * tanHalfFov * camera.aspect);
    const distanceForHeight = extentAlong(up) / (FRAME_FILL_HEIGHT * tanHalfFov);

    // Take whichever is further, so both constraints are satisfied.
    const distance = Math.max(distanceForWidth, distanceForHeight);

    cityCenter.current.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    controls.target.copy(center);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    controls.update();

    console.info(
      '[CameraRig] framed on bbox centre',
      center.toArray().map((n) => Math.round(n)),
      `distance ${Math.round(distance)}`,
    );
    return true;
  }, [camera, controls, scene]);

  /*
   * Frame on the first frame where both OrbitControls and the model exist. An
   * effect alone is not reliable here: the model arrives from Suspense, so it may
   * not be in the scene graph when effects first run.
   */
  const hasFramed = useRef(false);
  useFrame(() => {
    if (hasFramed.current) return;
    if (frameCity()) hasFramed.current = true;
  });

  // Reset is a one-shot action rather than a held state, so it is handled here as
  // its own listener instead of being polled from the movement Set every frame.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'KeyR') frameCity();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [frameCity]);

  useFrame((_state, delta) => {
    const pressed = keys.current;
    if (!controls || pressed.size === 0) return;

    // Forward is where the camera looks, flattened onto the horizontal plane.
    // Without zeroing Y, looking down at the city would drive you into the ground
    // when you pressed W, which feels broken.
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() < 1e-6) return; // looking straight down
    forward.current.normalize();

    right.current.crossVectors(forward.current, camera.up).normalize();

    move.current.set(0, 0, 0);
    if (pressed.has('KeyW')) move.current.add(forward.current);
    if (pressed.has('KeyS')) move.current.sub(forward.current);
    if (pressed.has('KeyD')) move.current.add(right.current);
    if (pressed.has('KeyA')) move.current.sub(right.current);
    if (pressed.has('KeyE')) move.current.y += 1;
    if (pressed.has('KeyQ')) move.current.y -= 1;

    if (move.current.lengthSq() === 0) return;

    // Normalise so holding W+D is not 1.41x faster than W alone.
    move.current.normalize();

    const boosted = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
    /*
     * Scaling by delta is what makes speed frame-rate independent. Without it the
     * camera moves a fixed amount PER FRAME, so the same keypress travels twice as
     * far on a 120 Hz monitor as on a 60 Hz one.
     */
    move.current.multiplyScalar(
      BASE_SPEED * (boosted ? BOOST_MULTIPLIER : 1) * delta,
    );

    /*
     * Move the camera AND the orbit target by the same vector. Moving only the
     * camera would swing it around a target left behind, so the next drag would
     * orbit around wherever you started rather than what you are looking at now.
     */
    camera.position.add(move.current);
    controls.target.add(move.current);

    // Keep both above the waterline so the hollow underside stays hidden.
    if (controls.target.y < MIN_HEIGHT) {
      camera.position.y += MIN_HEIGHT - controls.target.y;
      controls.target.y = MIN_HEIGHT;
    }
    if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;

    /*
     * Rein the target back toward the city if it wanders too far out to sea.
     * Applying the same correction to the camera keeps their relative offset
     * intact, so the view slides rather than snapping or spinning.
     */
    const offsetX = controls.target.x - cityCenter.current.x;
    const offsetZ = controls.target.z - cityCenter.current.z;
    const radius = Math.hypot(offsetX, offsetZ);
    if (radius > MAX_TARGET_RADIUS) {
      const pull = MAX_TARGET_RADIUS / radius;
      const correctionX = offsetX * pull - offsetX;
      const correctionZ = offsetZ * pull - offsetZ;
      controls.target.x += correctionX;
      controls.target.z += correctionZ;
      camera.position.x += correctionX;
      camera.position.z += correctionZ;
    }
  });

  return (
    <OrbitControls
      makeDefault
      // Damping is cheap and makes the whole thing feel considerably more
      // expensive than it is - motion eases out instead of stopping dead.
      enableDamping
      dampingFactor={0.05}
      /*
       * Just under a right angle. At exactly PI/2 the camera sits level with the
       * target and can slip beneath the island, exposing the hollow underside of
       * the cut-out tile. 0.12 rad (~7 deg) of margin keeps it comfortably above.
       */
      maxPolarAngle={Math.PI / 2 - 0.12}
      // Stop the user dollying inside a building, or so far out that the city
      // becomes a dot. The upper bound also keeps the camera comfortably inside
      // the sky dome and the far plane.
      minDistance={TARGET_SPAN * 0.05}
      maxDistance={TARGET_SPAN * 1.6}
    />
  );
}
