/*
 * Load instrumentation.
 *
 * The submission requires measured before/after numbers, so the app measures
 * itself rather than relying on someone reading a stopwatch. Everything here
 * comes from the browser's own Performance API:
 *
 *   - PerformanceNavigationTiming for the document
 *   - PerformanceResourceTiming for the model, which reports encoded vs decoded
 *     transfer size and the exact request duration
 *   - performance.now() at module evaluation through to the first rendered frame
 *     for time-to-interactive
 *
 * Kept in production builds deliberately: the numbers that matter are the ones
 * from the deployed site over a real network, not from localhost.
 */

const MODULE_LOAD_MS = performance.now();
const MODEL_FILENAME = 'manhattan_optimized.glb';

let alreadyReported = false;

const round = (value) => (typeof value === 'number' ? Math.round(value) : null);
const mb = (bytes) => (bytes ? +(bytes / 1e6).toFixed(2) : null);

/**
 * Called on the first frame rendered after the model is in the scene. That is a
 * meaningful definition of "interactive": Suspense has resolved, the geometry is
 * uploaded, and the render loop is running - the user can actually drag.
 */
export function reportInteractive() {
  if (alreadyReported) return;
  alreadyReported = true;

  const interactiveMs = performance.now() - MODULE_LOAD_MS;

  const navigation = performance.getEntriesByType('navigation')[0] ?? null;
  const model =
    performance.getEntriesByType('resource').find((entry) => entry.name.includes(MODEL_FILENAME)) ??
    null;

  const metrics = {
    timeToInteractiveMs: round(interactiveMs),
    // Time from navigation start until the page is fully loaded, for context.
    documentLoadMs: navigation ? round(navigation.duration) : null,
    domContentLoadedMs: navigation ? round(navigation.domContentLoadedEventEnd) : null,
    model: model
      ? {
          requestMs: round(model.duration),
          // transferSize is what actually crossed the network (0 when served from
          // cache); decodedBodySize is the file's real size. Reporting both makes
          // a cached measurement obvious instead of looking like a fast download.
          transferredMb: mb(model.transferSize),
          decodedMb: mb(model.decodedBodySize),
          servedFromCache: model.transferSize === 0 && model.decodedBodySize > 0,
        }
      : null,
  };

  // Exposed so the numbers can be copied straight out of the console rather than
  // transcribed by hand.
  window.__cityMetrics = metrics;

  console.info('[metrics]', metrics);
  return metrics;
}
