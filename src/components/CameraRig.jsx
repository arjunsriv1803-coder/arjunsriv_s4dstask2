import { useCallback, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import useFlyControls from '../hooks/useFlyControls';
import { TARGET_SPAN } from './CityModel';

/*
 * Movement speed as a fraction of the city's span, not an absolute number. If the
 * model is ever re-exported at a different scale, TARGET_SPAN keeps everything in
 * proportion and the controls still feel the same.
 */
const BASE_SPEED = TARGET_SPAN * 0.32; // world units per second
const BOOST_MULTIPLIER = 3;

/*
 * Framing padding, calibrated against the observed result: at 1.15 the city filled
 * roughly half the viewport width, so 0.82 targets ~70%. Lower means closer.
 */
const FRAME_PADDING = 0.82;

/*
 * Floor for both the camera and the orbit target. The model is a cut-out tile
 * whose underside is flat and hollow, so dropping below the waterline reveals the
 * hole. maxPolarAngle stops orbiting under it; this stops FLYING under it.
 */
const MIN_HEIGHT = TARGET_SPAN * 0.012;

export default function CameraRig() {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  const keys = useFlyControls();

  // Scratch vectors, allocated once. Creating Vector3s inside useFrame would mean
  // thousands of throwaway objects per second for the garbage collector to clean
  // up, which shows as periodic frame-time spikes.
  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const move = useRef(new Vector3());

  /*
   * Puts the camera back at the opening view. Deliberately computed from the
   * model's known world span and the camera's actual FOV rather than hardcoded, so
   * "reset" stays correct if the asset or the field of view changes.
   */
  const frameCity = useCallback(() => {
    if (!controls) return;

    const radius = TARGET_SPAN * 0.5;
    const verticalFov = (camera.fov * Math.PI) / 180;

    const fitVertical = radius / Math.tan(verticalFov / 2);
    // On a narrow/portrait window the horizontal axis becomes the tighter
    // constraint, so pull back by the aspect to avoid cropping the city.
    const fitHorizontal = fitVertical / Math.min(1, camera.aspect);
    const distance = Math.max(fitVertical, fitHorizontal) * FRAME_PADDING;

    // A 3/4 view reads as a city far better than straight-on or top-down.
    const direction = new Vector3(1, 0.62, 1).normalize();
    camera.position.copy(direction.multiplyScalar(distance));

    const target = new Vector3(0, TARGET_SPAN * 0.04, 0);
    controls.target.copy(target);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    controls.update();
  }, [camera, controls]);

  // Frame once, as soon as OrbitControls has registered itself.
  useEffect(() => {
    frameCity();
  }, [frameCity]);

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
    if (controls.target.y < MIN_HEIGHT) controls.target.y = MIN_HEIGHT;
    if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;
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
      // becomes a dot with the far plane clipping it.
      minDistance={TARGET_SPAN * 0.05}
      maxDistance={TARGET_SPAN * 2.2}
    />
  );
}
