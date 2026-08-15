/**
 * Three quality tiers.
 *
 * Each tier controls resolution, the environment probe and fog density.
 *
 * Post-processing is deliberately NOT here. It is latched in App rather than
 * derived from the tier, because toggling it re-mounts the EffectComposer and
 * reallocates every render target - see the note there.
 *
 * `antialias` is listed but is NOT switchable at runtime - see App.
 */
/*
 * On fog. This was linear (fogNear/fogFar) and is now exponential-squared.
 *
 * Linear fog ramps evenly between two distances, so any setting that veiled the
 * horizon also put haze on mid-distance geometry - at the default framing that
 * meant ~41% haze over the back half of the city, and everything read as the same
 * flat blue at every depth. No lighting change fixes atmosphere sitting on top of
 * the subject.
 *
 * exp2 stays near-transparent across the city and then thickens sharply, which
 * puts the atmosphere on the horizon where it belongs. Density is per world unit,
 * so the meaningful figures are the resulting percentages quoted per tier rather
 * than the constants themselves.
 */
export const TIERS = {
  high: {
    label: 'High',
    dpr: 1.5,
    antialias: true,
    environment: true,
    // exp2 density, per world unit. ~11% fogged at 1000 units, ~53% at 2500.
    fogDensity: 0.00034,
  },
  medium: {
    label: 'Medium',
    dpr: 1.0,
    antialias: true,
    environment: true,
    fogDensity: 0.0004,
  },
  low: {
    label: 'Low',
    dpr: 0.75,
    antialias: false,
    // Dropping the environment probe removes a cube-map render and all
    // image-based lighting lookups. The scene falls back to plain ambient plus
    // directional, which is flatter but materially cheaper.
    environment: false,
    // Slightly denser: pulling the visible distance in is a cheap way to reduce
    // what the fragment shader has to resolve on weak hardware.
    fogDensity: 0.00052,
  },
};

/** Ordered worst to best, so stepping up or down a tier is just an index shift. */
export const TIER_ORDER = ['low', 'medium', 'high'];

export function stepTier(current, direction) {
  const index = TIER_ORDER.indexOf(current);
  const next = Math.min(TIER_ORDER.length - 1, Math.max(0, index + direction));
  return TIER_ORDER[next];
}

/**
 * Picks the starting tier before the first frame is ever drawn.
 *
 * PerformanceMonitor can only react to frames that have already been rendered, so
 * without a sensible starting guess a weak device spends its first seconds
 * struggling at high quality - which is exactly when the user is forming an
 * impression, and on mobile is exactly when a tab is most likely to be killed.
 *
 * Touch-primary devices start low deliberately. `(pointer: coarse)` is a better
 * signal than screen size, which a large tablet or a small laptop both get wrong.
 */
export function detectInitialTier() {
  if (typeof navigator === 'undefined') return 'high';

  const isTouchPrimary =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  if (isTouchPrimary) return 'low';

  // hardwareConcurrency is a rough proxy - it reports CPU threads, not GPU power
  // - but a 2-4 thread machine is very unlikely to have a capable GPU. Browsers
  // may also under-report it for privacy, which errs toward the safer tier.
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 4) return 'medium';

  return 'high';
}
