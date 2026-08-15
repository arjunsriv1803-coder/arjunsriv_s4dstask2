import { useEffect, useState } from 'react';
import { TIERS } from '../lib/quality';

// 4 Hz. Fast enough to feel live, slow enough that the HUD's own React renders
// are irrelevant next to the 60 renders a second happening in the canvas.
const REFRESH_MS = 250;

/**
 * On-screen performance readout. Development builds only.
 *
 * Deliberately hand-rolled rather than using r3f-perf, which the PRD suggested.
 * r3f-perf 7.2.3 is the current release and still depends on @react-three/drei
 * v9, which requires React 18; this project runs React 19, and npm marks that
 * tree invalid. Reading WebGLRenderer.info directly is a dozen lines, has no
 * dependency risk, and produces exactly the figures the metrics table needs.
 */
export default function PerfHUD({ statsRef, tier, postProcessing }) {
  const [stats, setStats] = useState(() => ({ ...statsRef.current }));

  useEffect(() => {
    const id = setInterval(() => setStats({ ...statsRef.current }), REFRESH_MS);
    return () => clearInterval(id);
  }, [statsRef]);

  return (
    <div className="perf">
      <div className="perf__row">
        <span>FPS</span>
        <strong>{stats.fps ? stats.fps.toFixed(0) : '--'}</strong>
      </div>
      <div className="perf__row">
        <span>1% low</span>
        <strong>{Number.isFinite(stats.min) ? stats.min.toFixed(0) : '--'}</strong>
      </div>
      <div className="perf__row">
        <span>Draw calls</span>
        <strong>{stats.calls ?? '--'}</strong>
      </div>
      <div className="perf__row">
        <span>Triangles</span>
        <strong>{stats.triangles ? stats.triangles.toLocaleString() : '--'}</strong>
      </div>
      <div className="perf__row">
        <span>Textures</span>
        <strong>{stats.textures ?? '--'}</strong>
      </div>
      <div className="perf__row perf__row--tier">
        <span>Post FX</span>
        <strong>{postProcessing ? 'on' : 'off'}</strong>
      </div>
      <div className="perf__row">
        <span>Tier</span>
        <strong>
          {TIERS[tier].label} &middot; dpr {TIERS[tier].dpr}
        </strong>
      </div>
    </div>
  );
}
