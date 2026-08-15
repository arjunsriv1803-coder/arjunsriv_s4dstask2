import { PerformanceMonitor } from '@react-three/drei';
import { stepTier } from '../lib/quality';

/**
 * Watches real frame timings and moves the quality tier up or down.
 *
 * PerformanceMonitor samples frame duration over a window and fires onDecline
 * when the average falls short of the refresh rate, onIncline when there is
 * headroom to spare. Reacting to measured frames is the only honest way to do
 * this - device capability cannot be reliably inferred from a user-agent string.
 *
 * Note on AdaptiveDpr: the PRD also suggests drei's <AdaptiveDpr />. It is
 * deliberately not used. It writes the same `dpr` value this component derives
 * from the tier, and two independent systems driving one value oscillate - the
 * resolution visibly pulses. The tier system covers the same need and is legible
 * enough to explain.
 */
export default function QualityManager({ onTierChange }) {
  /*
   * This component deliberately does NOT touch dpr itself. The Canvas already
   * receives dpr from the active tier, so R3F applies it declaratively; calling
   * setDpr here as well would make two writers for one value - the exact problem
   * described above for AdaptiveDpr. This owns the tier, and dpr follows from it.
   */
  return (
    <PerformanceMonitor
      // Averaging over more frames than the default makes the tier stable: a
      // single stutter from a garbage collection pause should not drop quality.
      iterations={8}
      onDecline={() => onTierChange((current) => stepTier(current, -1))}
      onIncline={() => onTierChange((current) => stepTier(current, +1))}
    />
  );
}
