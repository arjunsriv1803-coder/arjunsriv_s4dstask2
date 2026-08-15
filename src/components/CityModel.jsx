import { useLayoutEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Box3, FrontSide, SRGBColorSpace, Vector3 } from 'three';
import { CITY_GROUP_NAME, TARGET_SPAN, computeMeshBounds } from '../lib/city';
import { detectInitialTier } from '../lib/quality';

/*
 * Two builds of the same geometry, differing only in atlas resolution.
 *
 * The 4K build is 11.05 MB with an 89.48 MB GPU footprint; the 2K build is
 * 8.42 MB and 22.37 MB. Texel density doubles at 4K, which is the whole point -
 * at 2048 the atlas is magnified even at overview distance.
 *
 * Which one loads is decided ONCE, from the tier detected before the first frame.
 * It deliberately does not follow later tier changes: swapping the model at
 * runtime would mean re-downloading and re-uploading everything mid-session,
 * which costs far more than the quality difference is worth. Later tier changes
 * move resolution and post-processing instead.
 */
const OPTIMIZED_URL = '/models/manhattan_optimized.glb'; // 2048 atlas
const HIGH_DETAIL_URL = '/models/manhattan_4k.glb'; // 4096 atlas
const HEAVY_URL = '/models/manhattan_heavy.glb';

/*
 * Baseline comparison switch, development builds only.
 *
 * The submission needs an honest "before" figure, which means the unoptimized
 * 519 MB source has to actually be loaded at least once and measured rather than
 * guessed at. Adding ?model=heavy in dev points the loader at it.
 *
 * import.meta.env.DEV is statically replaced at build time, so in production this
 * collapses away entirely and the query parameter does nothing - there is no way
 * to make a deployed visitor download half a gigabyte.
 *
 * The heavy file is gitignored (*_heavy.glb) and must never be committed.
 */
const useHeavyBaseline =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('model') === 'heavy';

// Low-tier devices get the 2K atlas: 22.37 MB of texture memory instead of
// 89.48 MB is the difference between running and being killed on a weak GPU.
const MODEL_URL = useHeavyBaseline
  ? HEAVY_URL
  : detectInitialTier() === 'low'
    ? OPTIMIZED_URL
    : HIGH_DETAIL_URL;

/*
 * Overrides the asset's roughnessFactor of 1.0. See the traverse below for why
 * the shipped value is wrong for this scene.
 */
const CITY_ROUGHNESS = 0.62;

if (useHeavyBaseline) {
  console.warn('[CityModel] baseline mode: loading the UNOPTIMIZED 519 MB source model');
}

export default function CityModel() {
  /*
   * Argument 2 is `useDraco`, argument 3 is `useMeshopt`.
   *
   * useMeshopt MUST stay true. The optimized GLB lists EXT_meshopt_compression in
   * extensionsRequired, so without the decoder registered the loader throws and
   * nothing renders at all - the vertex data is compressed, not merely packed.
   *
   * useDraco is explicitly false. drei defaults it to true, which attaches a
   * DRACOLoader pointing at a Google CDN. Our model carries no Draco data so that
   * decoder would never run, but disabling it removes a third-party origin from
   * the app for free.
   */
  const { scene } = useGLTF(MODEL_URL, false, true);
  const gl = useThree((state) => state.gl);

  /*
   * Normalise the model: centre it horizontally on its own mesh bounds, sit it on
   * y=0, and scale it to TARGET_SPAN. Deriving this from the measured bounding box
   * rather than hardcoded numbers means the scene still frames correctly if the
   * asset is ever re-exported at a different scale.
   */
  const fit = useMemo(() => {
    // Mesh-only bounds: see computeMeshBounds. Using full scene bounds would
    // centre the city on geometry (the LINES primitive) that is not the city.
    const box = computeMeshBounds(scene) ?? new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    // Scale on the larger horizontal axis. Using height instead would make a tall,
    // narrow model fill the screen vertically and vanish to a sliver.
    const span = Math.max(size.x, size.z);
    const scale = TARGET_SPAN / span;

    return {
      scale,
      // Offsets are applied INSIDE the scaled group, so they are in source units.
      // -center.x/-center.z centres it; -box.min.y drops its base onto the ground.
      offset: [-center.x, -box.min.y, -center.z],
    };
  }, [scene]);

  useLayoutEffect(() => {
    /*
     * Anisotropic filtering. This is the single biggest close-range quality win
     * available, and it is nearly free.
     *
     * Standard mipmapping picks one level of detail for the whole pixel, which is
     * correct for a surface square-on to the camera but badly wrong for one seen
     * at a steep angle - a road or a facade running away from the viewer. To
     * avoid aliasing the GPU picks a blurrier mip, so exactly the surfaces you
     * see most obliquely turn to mush. Anisotropic filtering takes multiple
     * samples along the direction of compression instead, keeping them sharp.
     *
     * Queried from the hardware rather than hardcoded; the cap is commonly 16 but
     * the driver is the authority, and requesting more than it supports is
     * silently clamped anyway.
     */
    const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
    let colourSpaceSeen = 'none';

    scene.traverse((object) => {
      if (!object.isMesh) return;

      // Assert rather than assume. Frustum culling is what stops the GPU shading
      // the parts of the city that are behind the camera on every frame.
      object.frustumCulled = true;

      // Shadows are off at the Canvas level, so leaving these true would have the
      // renderer walking the shadow path for meshes that never cast anything.
      object.castShadow = false;
      object.receiveShadow = false;

      // A material may be shared across meshes, so this can be reached more than
      // once; assigning the same value again is harmless.
      const texture = object.material?.map;
      if (texture) {
        if (texture.anisotropy !== maxAnisotropy) {
          texture.anisotropy = maxAnisotropy;
          // Filtering is a sampler parameter, so the texture must be re-uploaded
          // for the change to take effect.
          texture.needsUpdate = true;
        }

        /*
         * Colour textures must be tagged sRGB. If a colour map is treated as
         * linear, the renderer skips the sRGB-to-linear conversion on read and
         * every value comes out too bright and low-contrast - washed out, exactly
         * the symptom being chased here.
         *
         * GLTFLoader normally sets this correctly for baseColorTexture, so this
         * is an assertion rather than an expected fix. It is logged either way so
         * the assumption is visible rather than trusted.
         */
        if (texture.colorSpace !== SRGBColorSpace) {
          console.warn(
            `[CityModel] baseColor map was "${texture.colorSpace}", forcing sRGB`,
          );
          texture.colorSpace = SRGBColorSpace;
          texture.needsUpdate = true;
        }
        colourSpaceSeen = texture.colorSpace;
      }

      /*
       * The asset ships roughnessFactor = 1 with no metallic-roughness map.
       *
       * Fully rough means zero specular response: no sky reflection, no sun
       * sheen, no highlight anywhere. Every surface renders as flat matte
       * diffuse, which is why a city of glass and polished stone looked dead
       * regardless of how the lights were tuned. Since there is no roughness
       * map to respect, a single sensible value is strictly better than the
       * exporter's default.
       *
       * 0.62 is chosen to sit between concrete and glass. Lower turns the whole
       * city into a mirror and reintroduces the hard-edged Lightformer
       * reflections that had to be fixed on the water.
       */
      const material = object.material;
      if (material && material.roughness !== CITY_ROUGHNESS) {
        /*
         * BACKFACE CULLING. The asset ships doubleSided: true.
         *
         * This is a cut-out tile with a hollow underside and a ragged scan
         * boundary, so double-sided rendering means you see the INSIDE of the
         * shell wherever the camera looks past an edge - which renders as unlit
         * dark surfaces and makes the model look broken. Culling back faces means
         * those simply are not drawn, and you see the water behind instead.
         *
         * It also stops the GPU shading roughly half the fragments on closed
         * geometry, which is free performance.
         *
         * Risk worth knowing: photogrammetry meshes occasionally have
         * inconsistent triangle winding, in which case culling punches visible
         * holes. Revert by deleting this line if that appears.
         */
        material.side = FrontSide;
        material.roughness = CITY_ROUGHNESS;
        // Left at 0. The city is mostly stone and concrete; any metalness makes
        // the whole atlas read as painted tin.
        material.metalness = 0;
        // Lets the environment probe actually contribute now that the surface
        // can reflect at all.
        material.envMapIntensity = 1.15;
        material.needsUpdate = true;
      }
    });

    console.info(
      `[CityModel] ${MODEL_URL.split('/').pop()} | anisotropy ${maxAnisotropy}x | ` +
        `roughness ${CITY_ROUGHNESS} (asset shipped 1.0) | colorSpace ${colourSpaceSeen}`,
    );
  }, [scene, gl]);

  // Bounding box logging - the single most useful diagnostic when a model does not
  // appear. If the city is invisible it is nearly always scale or position, and
  // these numbers say which immediately.
  useLayoutEffect(() => {
    const box = computeMeshBounds(scene);
    if (!box) return;
    const size = box.getSize(new Vector3());
    console.info(
      '[CityModel] source mesh bbox',
      {
        min: box.min.toArray().map((n) => +n.toFixed(3)),
        max: box.max.toArray().map((n) => +n.toFixed(3)),
        size: size.toArray().map((n) => +n.toFixed(3)),
      },
      `-> scale x${fit.scale.toFixed(2)} -> world span ${TARGET_SPAN}`,
    );
  }, [scene, fit]);

  return (
    // Named so CameraRig can look the city up in the scene graph and frame the
    // camera against its real world bounds, rather than assuming it sits at the
    // origin. Avoids threading refs or a store through the tree for one value.
    <group name={CITY_GROUP_NAME} scale={fit.scale}>
      <primitive object={scene} position={fit.offset} />
    </group>
  );
}

// Start fetching the model as soon as this module is parsed, rather than waiting
// for React to mount the component. Costs nothing and shaves the wait.
useGLTF.preload(MODEL_URL, false, true);
