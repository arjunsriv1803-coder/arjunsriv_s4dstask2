import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer, Sky } from '@react-three/drei';
import CityModel, { TARGET_SPAN, WATER_LEVEL } from './CityModel';
import CameraRig from './CameraRig';

/*
 * One sun direction, shared by the sky shader and the directional light. If these
 * disagree, the buildings are lit from one side while the bright spot in the sky
 * sits somewhere else - the scene reads as wrong without it being obvious why.
 */
const SUN_POSITION = [600, 820, 420];

/*
 * Fog colour is the pale blue-grey of the sky at the horizon, deliberately.
 * Fog does two jobs here: it sells atmospheric depth, and it dissolves distant
 * geometry into the sky so the far clipping plane is never visible as a hard edge.
 * If this colour and the horizon disagree you get a visible band instead.
 */
const HORIZON_COLOUR = '#c9d6e4';
const FOG_NEAR = TARGET_SPAN * 0.7;
const FOG_FAR = TARGET_SPAN * 2.4;

const SKY_RADIUS = TARGET_SPAN * 2.2;

/**
 * Keeps a group pinned to the camera so it can never be escaped or clipped.
 *
 * This is what lets the far plane stay tight. A sky dome parked at the origin
 * would have to be enormous - big enough that flying anywhere still leaves you
 * inside it - which in turn forces a huge far plane and throws away depth
 * precision. Centred on the camera instead, a 2200-unit dome is always exactly
 * 2200 away, so a 2600 far plane covers it forever.
 *
 * `lockY` keeps the ocean at its own fixed height while still tracking
 * horizontally, so it follows you without ever rising or sinking.
 */
function FollowCamera({ children, lockY = null }) {
  const ref = useRef(null);
  useFrame(({ camera }) => {
    const group = ref.current;
    if (!group) return;
    group.position.x = camera.position.x;
    group.position.z = camera.position.z;
    group.position.y = lockY === null ? camera.position.y : lockY;
  });
  return <group ref={ref}>{children}</group>;
}

export default function CityScene() {
  return (
    <>
      {/*
        Procedural Preetham sky - a shader, not a texture, so it costs no download
        and cannot 404. Its material has no fog support, which is exactly right:
        the sky stays clear while everything in front of it fades into the matching
        fog colour.
      */}
      <FollowCamera>
        <Sky
          distance={SKY_RADIUS}
          sunPosition={SUN_POSITION}
          turbidity={8}
          rayleigh={1.2}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />
      </FollowCamera>

      <fog attach="fog" args={[HORIZON_COLOUR, FOG_NEAR, FOG_FAR]} />

      {/*
        Image-based lighting built from shapes rather than an HDRI file.

        drei's `preset` prop fetches a 1K HDR from raw.githack.com - a third-party
        origin sitting on the critical load path, which risks a cold-cache stall or
        an outright 404 in production. These Lightformers render once into a small
        local cube map instead: no network, no failure mode.

        frames={1} renders that probe a single time. Nothing here moves, so
        re-rendering it every frame would be pure waste.
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
        {/* The sun, for a tight specular highlight on the water. */}
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

      {/*
        Ocean.

        The model is a cut-out island tile: hollow underneath, with a raw vertical
        cut edge around its rim. Without this the island floats in a void and reads
        as a broken asset. Tracking the camera horizontally means the plane is
        effectively infinite - you can never reach its edge - while a modest size
        keeps it inside the far plane.

        Low roughness with metalness makes it pick up the Environment probe, which
        is what reads as water rather than a flat blue card. A genuinely reflective
        material would re-render the scene every frame; this costs nothing extra.
      */}
      <FollowCamera lockY={WATER_LEVEL}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[TARGET_SPAN * 6, TARGET_SPAN * 6]} />
          <meshStandardMaterial color="#3d5d7d" roughness={0.18} metalness={0.65} />
        </mesh>
      </FollowCamera>

      <CityModel />
      <CameraRig />
    </>
  );
}
