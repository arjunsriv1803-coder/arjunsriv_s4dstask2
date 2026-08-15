import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DataTexture, RGBAFormat, RepeatWrapping, Vector3 } from 'three';
import { TARGET_SPAN } from '../lib/city';

const TEXTURE_SIZE = 256;
// How many times the wave pattern tiles across the plane. High enough that
// individual repeats are not readable as a grid.
const WAVE_REPEAT = 90;

/**
 * Builds a tiling wave normal map in code.
 *
 * Generated rather than downloaded for the same reason the environment is
 * procedural: no network request on the critical path, nothing that can 404.
 *
 * Every frequency is an integer multiple of 2*PI/size, so the pattern is exactly
 * periodic across the texture edges and tiles seamlessly. Non-integer frequencies
 * would leave a visible seam every repeat, which at 90 repeats would read as a
 * grid across the whole ocean.
 */
function createWaveNormalMap(size) {
  const data = new Uint8Array(size * size * 4);
  const k = (2 * Math.PI) / size;

  // Sum of a few offset sine waves. Cheap, and the cross-modulation (a sine
  // inside another sine's phase) is what stops it looking like corduroy.
  const height = (x, y) =>
    Math.sin(k * 3 * x + 2 * Math.sin(k * 2 * y)) +
    0.7 * Math.sin(k * 5 * y + 1.5 * Math.sin(k * 2 * x)) +
    0.5 * Math.sin(k * 2 * x + k * 3 * y);

  const normal = new Vector3();

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Central differences, wrapped, so the gradient is seamless too.
      const left = height((x - 1 + size) % size, y);
      const rightSample = height((x + 1) % size, y);
      const down = height(x, (y - 1 + size) % size);
      const upSample = height(x, (y + 1) % size);

      // A height field's normal is (-dH/dx, -dH/dy, 1), normalised. The Z term
      // controls how pronounced the bumps read.
      normal.set(-(rightSample - left), -(upSample - down), 2.4).normalize();

      const i = (y * size + x) * 4;
      // Normals are stored biased into 0..1 because texture channels are unsigned.
      data[i] = (normal.x * 0.5 + 0.5) * 255;
      data[i + 1] = (normal.y * 0.5 + 0.5) * 255;
      data[i + 2] = (normal.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(WAVE_REPEAT, WAVE_REPEAT);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The ocean surrounding the island.
 *
 * Material values here are deliberate. An earlier version used roughness 0.18 with
 * metalness 0.65, which made the surface behave as a near-perfect mirror - and
 * since the environment probe is built from a handful of Lightformer rectangles,
 * their literal shapes reflected back as hard-edged geometric patches across the
 * sea. Four changes fix it together:
 *
 *   - metalness 0: a dielectric reflects only ~4% at normal incidence, instead of
 *     a metal's full-colour mirror reflection.
 *   - roughness 0.62: pushes environment sampling into blurrier mip levels, so
 *     any reflected shape is smeared rather than sharp.
 *   - envMapIntensity 0.22: scales down what little env contribution remains.
 *   - a wave normal map: the surface is no longer a perfect plane, so reflected
 *     detail is broken up per-pixel rather than mirrored coherently.
 *
 * The result reads as diffuse open water with a soft sun glitter, which is what a
 * sea at this scale should look like.
 */
export default function Water({ level }) {
  const normalMap = useMemo(() => createWaveNormalMap(TEXTURE_SIZE), []);
  const groupRef = useRef(null);

  useFrame(({ camera }, delta) => {
    // Track the camera horizontally so the ocean is effectively infinite - its
    // edge can never be reached - while a modest plane size keeps it inside the
    // far clipping plane.
    const group = groupRef.current;
    if (group) {
      group.position.x = camera.position.x;
      group.position.z = camera.position.z;
    }

    // Drift the waves. Scrolling the normal map is far cheaper than displacing
    // real geometry and, at this viewing distance, indistinguishable.
    normalMap.offset.x += delta * 0.006;
    normalMap.offset.y += delta * 0.004;
  });

  return (
    <group ref={groupRef} position={[0, level, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[TARGET_SPAN * 6, TARGET_SPAN * 6]} />
        <meshStandardMaterial
          color="#33566f"
          roughness={0.62}
          metalness={0}
          envMapIntensity={0.22}
          normalMap={normalMap}
          // Kept low: strong normals on a flat plane viewed at a grazing angle
          // turn into visible noise rather than waves.
          normalScale={[0.28, 0.28]}
        />
      </mesh>
    </group>
  );
}
