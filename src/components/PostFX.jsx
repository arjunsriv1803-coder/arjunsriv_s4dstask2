import { EffectComposer, N8AO, Bloom, Vignette, SMAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

/**
 * Post-processing stack. HIGH TIER ONLY.
 *
 * Every effect here is a full-screen pass, so cost scales with pixel count rather
 * than scene complexity. That is exactly why it is gated on the tier and dropped
 * wholesale rather than kept on with reduced settings: on a weak GPU the problem
 * is fill rate, and half-strength full-screen passes still cost fill rate.
 *
 * Order matters. Ambient occlusion runs first, against raw scene depth, before
 * anything else touches the buffer. Antialiasing runs last so it resolves the
 * finished composite rather than an intermediate.
 */
export default function PostFX({ enabled }) {
  if (!enabled) return null;

  return (
    <EffectComposer
      /*
       * MSAA off, SMAA on at the end of the chain instead. The canvas's own
       * antialias flag does not apply once rendering goes through a composer -
       * its render targets are separate buffers - so without SMAA the High tier
       * would actually look WORSE than the tiers with no post-processing.
       */
      multisampling={0}
    >
      {/*
        Ambient occlusion. The single biggest contributor to the scene reading as
        solid rather than flat: it darkens where surfaces meet, which in a city
        means the base of every tower and the depth of every street canyon. The
        asset carries no AO map, so without this there is nothing visually
        anchoring the buildings to the ground.

        aoRadius is in WORLD units, which is why it has to be read against the
        1000-unit city span - 24 spans the gap between neighbouring buildings
        without bleeding across an entire block.

        halfRes runs the AO at quarter the pixels and upsamples. On a full-screen
        effect that is close to a 4x saving on the most expensive pass here, for a
        softness that is invisible against geometry this large.
      */}
      <N8AO
        aoRadius={24}
        distanceFalloff={1.3}
        intensity={2.4}
        quality="medium"
        halfRes
      />

      {/*
        Bloom with a high threshold so only genuine highlights bloom - sun glint on
        glass, the specular streak on the water. A low threshold blooms the whole
        sky and undoes the contrast the AO just added.
      */}
      <Bloom luminanceThreshold={0.72} luminanceSmoothing={0.24} intensity={0.4} mipmapBlur />

      {/* Slight corner darkening; pulls the eye to centre frame for almost nothing. */}
      <Vignette offset={0.32} darkness={0.4} blendFunction={BlendFunction.NORMAL} />

      <SMAA />
    </EffectComposer>
  );
}
