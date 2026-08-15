import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import CityScene from './components/CityScene';

export default function App() {
  return (
    <Canvas
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        // Nothing in this scene uses the stencil buffer, so allocating one is pure
        // waste of memory and bandwidth on every frame.
        stencil: false,
        depth: true,
      }}
      /*
       * The single biggest free performance win available.
       *
       * Uncapped, a high-DPI screen reports devicePixelRatio 2 or 3, and the
       * renderer then draws 4x or 9x the pixels for a difference you cannot see on
       * geometry this dense. Capping at 1.5 keeps edges clean while cutting the
       * fragment workload dramatically. The [min, max] form lets R3F pick within
       * the range rather than forcing one value.
       */
      dpr={[1, 1.5]}
      /*
       * near/far are deliberately tight around the model's 1000-unit world span.
       * The depth buffer's precision is distributed logarithmically between them,
       * so leaving near at 0.1 and far at 100000 spends nearly all of it in the
       * first few units and causes z-fighting on distant buildings.
       * AutoFrame overwrites `position` on mount; this value only covers the very
       * first frame before the model's bounds are known.
       */
      camera={{ position: [900, 560, 900], fov: 55, near: 1, far: 5000 }}
      /*
       * Real-time shadow maps across an entire city are ruinously expensive - every
       * shadow-casting light re-renders the scene from its own point of view. The
       * model already carries baked ambient occlusion, so directional lighting
       * alone reads as convincing depth at a fraction of the cost.
       */
      shadows={false}
    >
      {/* useGLTF suspends while the model downloads and decodes. Without a
          Suspense boundary that would propagate up and blank the whole app. */}
      <Suspense fallback={null}>
        <CityScene />
      </Suspense>
    </Canvas>
  );
}
