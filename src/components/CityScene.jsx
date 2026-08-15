import { Environment, Lightformer } from '@react-three/drei';
import CityModel from './CityModel';
import { TARGET_SPAN, WATER_LEVEL } from '../lib/city';
import CameraRig from './CameraRig';
import GradientSky from './GradientSky';
import Water from './Water';
import ReadyProbe from './ReadyProbe';
import PostFX from './PostFX';

/*
 * Sun direction, shared by the sky shader and the key light. If these disagree,
 * the buildings are lit from one side while the bright spot in the sky sits
 * somewhere else, and the scene reads as wrong without it being obvious why.
 *
 * Lowered from [600, 820, 420]. A high sun lights every roof evenly and leaves
 * facades flat, which is the worst case for a city: the vertical surfaces are
 * what you actually look at. Dropping the elevation rakes light across the
 * facades and pushes the streets between towers into shadow, which is where the
 * sense of depth in a cityscape comes from.
 */
const SUN_POSITION = [720, 430, 380];

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

const SKY_RADIUS = TARGET_SPAN * 2.2;

export default function CityScene({ settings, destination, postProcessing }) {
  return (
    <>
      <GradientSky
        radius={SKY_RADIUS}
        horizonColor={HORIZON_COLOUR}
        zenithColor={ZENITH_COLOUR}
        sunPosition={SUN_POSITION}
      />

      {/*
        Exponential-squared fog rather than linear.

        Linear fog ramps evenly from fogNear to fogFar, so tuning it to veil the
        horizon necessarily put haze on mid-distance geometry too - everything
        ended up the same flat blue at every depth. exp2 stays near-transparent
        across the whole city and then thickens sharply, so atmosphere lands on the
        horizon instead of in the street.

        Density is per world unit and tiny by nature: at 0.00034 a surface 1000
        units away is ~11% fogged, one 2500 away is ~53%. Those are the numbers
        that matter, not the constant itself.
      */}
      <fogExp2 attach="fog" args={[HORIZON_COLOUR, settings.fogDensity]} />

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

        Resolution is 256 rather than 128 because the buildings are no longer
        fully rough and so actually reflect this probe now, which makes its
        resolution start to show. Still rendered once, so the cost is one-off.
      */}
      {settings.environment && (
        <Environment frames={1} resolution={256}>
          {/*
            THE IMPORTANT LINE. Without a background the probe's cube map is BLACK
            everywhere the Lightformers below do not cover - which is most of it.
            Every surface then reflects black, and since the building albedo
            averages only 35% luminance to begin with, the facades were being
            pushed almost to black. Filling the probe with sky means a surface
            facing nowhere in particular reflects sky, which is what it should do.
          */}
          <color attach="background" args={['#93aec8']} />
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
          <Lightformer
            form="circle"
            intensity={3}
            color="#fff4e2"
            scale={2.4}
            position={[5, 7, 4]}
          />
          {/* Cooler horizon bounce so shadowed faces are not dead flat. */}
          <Lightformer
            form="rect"
            intensity={0.45}
            color="#b9c9dc"
            scale={[12, 4, 1]}
            position={[0, 1, -9]}
          />
        </Environment>
      )}

      {/*
        LIGHTING IS DELIBERATELY KEY-DOMINANT.

        This asset is photogrammetry: shading, occlusion and contact shadow are
        already painted into the albedo. Piling on ambient and environment light
        re-lights surfaces that are already lit, which flattens the very detail the
        texture carries - that is what made earlier attempts read as washed out no
        matter which direction the values moved.

        So ambient drops hard and the key does the work. Ambient here is a floor to
        stop shadowed faces crushing to black, not a light source.
      */}
      <ambientLight intensity={settings.environment ? 0.18 : 0.34} color="#c8d8ea" />

      {/*
        Cool sky above, warm ground bounce below. A hemisphere light gives that
        split for one extra shading term and no draw call, and it is what stops
        shadowed faces reading as flat grey.
      */}
      <hemisphereLight args={['#bcd4ee', '#6b6558', 0.42]} />

      {/*
        The key. Warm, strong, and low - see SUN_POSITION. Raked light across the
        facades plus the baked AO is what produces relief; a high weak key with
        heavy ambient produced neither.
      */}
      <directionalLight position={SUN_POSITION} intensity={2.6} color="#ffeacd" />

      <Water level={WATER_LEVEL} />

      <CityModel />
      <CameraRig destination={destination} />

      {/* Inside Suspense, so its first frame is the first genuinely interactive
          one. Logs load timings to the console and window.__cityMetrics. */}
      <ReadyProbe />

      {/* Last child: the composer wraps everything rendered before it. */}
      <PostFX enabled={postProcessing} />
    </>
  );
}
