import { Suspense, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import CityScene from './components/CityScene';
import LoadingScreen from './components/LoadingScreen';
import ControlsOverlay from './components/ControlsOverlay';
import QualityManager from './components/QualityManager';
import PerfSampler from './components/PerfSampler';
import PerfHUD from './components/PerfHUD';
import WaypointNav from './components/WaypointNav';
import { TIERS, detectInitialTier } from './lib/quality';

// Dev-only instrumentation. Vite statically replaces this, so the HUD and its
// sampler are dropped from the production bundle entirely rather than shipped
// and hidden.
const SHOW_PERF = import.meta.env.DEV;

export default function App() {
  /*
   * Chosen before the first frame from device signals, then adjusted by
   * QualityManager from measured frame timings. The initial guess matters: a
   * monitor can only react to frames already rendered, so without it a weak
   * device spends its first seconds struggling at full quality.
   */
  const [tier, setTier] = useState(detectInitialTier);
  const settings = TIERS[tier];

  /*
   * Captured once, on the first render, and never updated. See the `antialias`
   * note below: feeding a changing value into a WebGL context attribute would be
   * misleading, because nothing would actually change.
   */
  const initialAntialias = useRef(settings.antialias);

  /*
   * The requested fast-travel destination.
   *
   * `nonce` is the point of the wrapper object: clicking the same waypoint twice
   * should fly there again, but the waypoint object itself is unchanged, so the
   * effect in CameraRig would not re-run without a value that always differs.
   */
  const [destination, setDestination] = useState(null);

  // Per-frame stats live in a ref so the sampler never triggers a React render.
  const statsRef = useRef({
    fps: 0,
    min: Infinity,
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    samples: [],
  });

  return (
    <div className="app">
      <Canvas
        gl={{
          /*
           * Fixed at context creation and NOT switchable later - antialias is a
           * WebGL context attribute, so changing it at runtime would mean tearing
           * down and rebuilding the canvas, losing every uploaded buffer and
           * texture. It therefore follows the tier detected before first paint,
           * and a later tier change adjusts resolution instead.
           */
          antialias: initialAntialias.current,
          powerPreference: 'high-performance',
          /*
           * Slight lift over the default 1.0. ACES filmic tone mapping rolls the
           * highlights off hard, which suits a bright sky but leaves street-level
           * facades sitting low in the curve. A small bump lifts the midtones
           * without blowing out the sky - 1.12 proved too much and washed the
           * facades out, so this sits midway back toward neutral.
           */
          toneMappingExposure: 1.06,
          // Nothing in this scene uses the stencil buffer, so allocating one is
          // pure waste of memory and bandwidth on every frame.
          stencil: false,
          depth: true,
        }}
        /*
         * The single biggest free performance win available.
         *
         * Uncapped, a high-DPI screen reports devicePixelRatio 2 or 3, and the
         * renderer then draws 4x or 9x the pixels for a difference you cannot see
         * on geometry this dense. The tier sets the ceiling; QualityManager
         * lowers it live if frames start dropping.
         */
        dpr={[1, settings.dpr]}
        /*
         * near/far are deliberately tight around the model's 1000-unit world span.
         * Depth buffer precision is distributed non-linearly between them, so
         * leaving near at 0.1 and far at 100000 spends almost all of it in the
         * first few units and causes z-fighting on distant buildings.
         *
         * far can stay this low only because the sky dome and the ocean both
         * track the camera (see CityScene) - neither can ever fall outside it.
         * Fog saturates before it, so no clipping plane is ever visible.
         *
         * CameraRig overwrites `position` once the model's bounds are known; this
         * value only covers the very first frame.
         */
        camera={{ position: [900, 560, 900], fov: 55, near: 2, far: 2600 }}
        /*
         * Real-time shadow maps across an entire city are ruinously expensive -
         * every shadow-casting light re-renders the scene from its own point of
         * view. The model already carries baked ambient occlusion, so directional
         * lighting alone reads as convincing depth at a fraction of the cost.
         */
        shadows={false}
      >
        <QualityManager onTierChange={setTier} />
        {SHOW_PERF && <PerfSampler statsRef={statsRef} />}

        {/* useGLTF suspends while the model downloads and decodes. Without a
            Suspense boundary that would propagate up and blank the whole app.
            The fallback is null because the loading UI is DOM, not 3D - it has to
            be visible precisely when the canvas has nothing to show. */}
        <Suspense fallback={null}>
          <CityScene settings={settings} destination={destination} />
        </Suspense>
      </Canvas>

      {/* Overlays are siblings of the Canvas, not children: they are ordinary DOM
          positioned on top, so they stay crisp and selectable rather than being
          rendered into the WebGL context. */}
      <LoadingScreen />
      <WaypointNav
        activeId={destination?.waypoint.id ?? null}
        onSelect={(waypoint) => setDestination({ waypoint, nonce: performance.now() })}
      />
      <ControlsOverlay />
      {SHOW_PERF && <PerfHUD statsRef={statsRef} tier={tier} />}
    </div>
  );
}
