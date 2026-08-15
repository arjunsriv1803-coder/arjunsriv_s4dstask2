import { useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

// Frames averaged for the displayed FPS. ~1 second at 60 Hz: long enough to be
// steady, short enough to react while you are still moving the camera.
const WINDOW = 60;

/**
 * Samples real renderer statistics every frame.
 *
 * Reads WebGLRenderer.info, which is the renderer's own accounting rather than an
 * estimate: `render.calls` is the exact number of draw calls issued for the last
 * frame and `render.triangles` the exact number of triangles submitted. These are
 * the numbers reported in the metrics table.
 *
 * Writes into a ref instead of React state on purpose. Calling setState 60 times
 * a second would re-render the tree every frame purely to display a number, which
 * would itself cost more than the thing being measured. The HUD reads this ref on
 * a slow interval.
 */
export default function PerfSampler({ statsRef }) {
  const gl = useThree((state) => state.gl);

  /*
   * Take manual control of the stats reset.
   *
   * By default WebGLRenderer clears info.render on every render() call. With a
   * post-processing composer there are SEVERAL render calls per frame, so reading
   * the counters afterwards reports only the last one - which is a single
   * fullscreen blit. That is why the HUD read "1 draw call, 1 triangle" with
   * post-processing on while the scene plainly had 17.
   *
   * With autoReset off the counters accumulate across every pass. This effect
   * reads the running total at the start of the next frame and then clears it, so
   * the figure shown is the true whole-frame cost.
   */
  useLayoutEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((_state, delta) => {
    const stats = statsRef.current;

    // delta is seconds since the previous frame; guard against the 0 that can
    // arrive on the very first frame or after a tab is restored.
    if (delta > 0) {
      stats.samples.push(1 / delta);
      if (stats.samples.length > WINDOW) stats.samples.shift();
    }

    const samples = stats.samples;
    if (samples.length > 0) {
      let sum = 0;
      let min = Infinity;
      for (const value of samples) {
        sum += value;
        if (value < min) min = value;
      }
      stats.fps = sum / samples.length;
      stats.min = min;
    }

    // Accumulated across every pass of the PREVIOUS frame, since autoReset is off
    // and the reset happens below. This is the real whole-frame cost.
    stats.calls = gl.info.render.calls;
    stats.triangles = gl.info.render.triangles;
    stats.geometries = gl.info.memory.geometries;
    stats.textures = gl.info.memory.textures;

    // Clear for the frame about to be rendered.
    gl.info.reset();
  });

  return null;
}
