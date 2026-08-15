import { TARGET_SPAN } from './city';

/**
 * Three quality tiers.
 *
 * Fog distances are fractions of TARGET_SPAN rather than the PRD's absolute
 * numbers, which assumed a differently scaled world. Expressed as absolutes here
 * they would be wrong: the low tier's suggested 1200 is shorter than the distance
 * from the default camera to the far side of the city (~1400), so it would fog
 * out the very thing the user came to look at.
 *
 * `antialias` is listed but is NOT switchable at runtime - see below.
 */
export const TIERS = {
  high: {
    label: 'High',
    dpr: 1.5,
    antialias: true,
    environment: true,
    fogNear: TARGET_SPAN * 0.7,
    fogFar: TARGET_SPAN * 2.4,
  },
  medium: {
    label: 'Medium',
    dpr: 1.0,
    antialias: true,
    environment: true,
    fogNear: TARGET_SPAN * 0.6,
    fogFar: TARGET_SPAN * 2.0,
  },
  low: {
    label: 'Low',
    dpr: 0.75,
    antialias: false,
    // Dropping the environment probe removes a cube-map render and all
    // image-based lighting lookups. The scene falls back to plain ambient plus
    // directional, which is flatter but materially cheaper.
    environment: false,
    fogNear: TARGET_SPAN * 0.5,
    fogFar: TARGET_SPAN * 1.7,
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
