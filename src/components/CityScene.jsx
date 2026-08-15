import { Environment, Lightformer } from '@react-three/drei';
import CityModel from './CityModel';
import { TARGET_SPAN, WATER_LEVEL } from '../lib/city';
import CameraRig from './CameraRig';
import GradientSky from './GradientSky';
import Water from './Water';

/*
 * One sun direction, shared by the sky shader and the directional light. If these
 * disagree, the buildings are lit from one side while the bright spot in the sky
 * sits somewhere else - the scene reads as wrong without it being obvious why.
 */
const SUN_POSITION = [600, 820, 420];

/*
 * The single source of truth for "what colour is the distance".
 *
 * This exact value is used three times: as the sky's horizon colour, as the fog
 * colour, and therefore as the colour distant geometry fades into. Sharing one
 * constant is what makes a horizon seam impossible - an earlier version had the
 * fog and the sky's horizon as independent values, and the mismatch showed up as
 * a bright grey band across the view.
 */
const HORIZON_COLOUR = '#c9d6e4';
const ZENITH_COLOUR = '#4f86c6';

const FOG_NEAR = TARGET_SPAN * 0.7;
/*
 * Fog must saturate before the ocean plane's own edge (3000 units) and before the
 * far clipping plane (2600), or the water would visibly stop somewhere in view.
 */
const FOG_FAR = TARGET_SPAN * 2.4;

const SKY_RADIUS = TARGET_SPAN * 2.2;

export default function CityScene() {
  return (
    <>
      <GradientSky
        radius={SKY_RADIUS}
        horizonColor={HORIZON_COLOUR}
        zenithColor={ZENITH_COLOUR}
        sunPosition={SUN_POSITION}
      />

      <fog attach="fog" args={[HORIZON_COLOUR, FOG_NEAR, FOG_FAR]} />

      {/*
        Image-based lighting built from shapes rather than an HDRI file.

        drei's Environment "preset" prop fetches a 1K HDR from raw.githack.com - a
        third-party origin on the critical load path, which risks a cold-cache
        stall or an outright 404 in production. These Lightformers render once into
        a small local cube map instead: no network, no failure mode.

        frames={1} renders that probe a single time. Nothing here moves, so
        re-rendering it every frame would be pure waste.

        Note these shapes are what the water reflects, so their hard edges are only
        acceptable because the water material is deliberately rough and barely
        reflective - see Water.jsx.
      */}
      <Environment frames={1} resolution={128}>
        {/* Broad dome overhead - the dominant ambient contribution. */}
        <Lightformer
          form="rect"
          intensity={0.9}
          color="#cfe0f2"
          scale={[12, 12, 1]}
          position={[0, 6, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
        {/* The sun, for a soft specular glitter on the water. */}
        <Lightformer form="circle" intensity={3} color="#fff4e2" scale={2.4} position={[5, 7, 4]} />
        {/* Cooler horizon bounce so shadowed faces are not dead flat. */}
        <Lightformer
          form="rect"
          intensity={0.45}
          color="#b9c9dc"
          scale={[12, 4, 1]}
          position={[0, 1, -9]}
        />
      </Environment>

      {/* Ambient keeps unlit faces readable; directional gives the massing its
          consistent sun direction, which is what makes the buildings legible. */}
      <ambientLight intensity={0.45} />
      <directionalLight position={SUN_POSITION} intensity={1.6} />

      <Water level={WATER_LEVEL} />

      <CityModel />
      <CameraRig />
    </>
  );
}
