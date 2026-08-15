import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, ShaderMaterial, Vector3 } from 'three';

/**
 * A vertical-gradient sky dome.
 *
 * WHY NOT drei's <Sky>: that is a Preetham atmospheric model whose horizon colour
 * is an emergent result of turbidity, rayleigh and sun angle. The fog colour is a
 * separate constant, so the two drift apart and you get a visible grey seam where
 * fogged geometry meets the sky - which is exactly what happened. Preetham also
 * washes out to near-white near the horizon at higher turbidity.
 *
 * Here the horizon colour is an INPUT. Passing the same value to this dome and to
 * the fog makes a seam impossible by construction: distant geometry fades to
 * exactly the colour of the sky it fades into.
 *
 * The dome is parented to the camera by the caller, so its radius stays constant
 * relative to the viewer and the far plane can stay tight.
 */
export default function GradientSky({
  radius,
  horizonColor,
  zenithColor,
  sunPosition,
  sunColor = '#fff3df',
}) {
  const groupRef = useRef(null);

  const material = useMemo(() => {
    return new ShaderMaterial({
      // Rendered from inside, so draw the far faces.
      side: BackSide,
      // The sky is a backdrop; it must never occlude scene geometry.
      depthWrite: false,
      // No fog on the sky itself. Fogging it would tint the backdrop toward the
      // fog colour a second time and flatten the whole gradient.
      fog: false,
      uniforms: {
        uHorizon: { value: new Color(horizonColor) },
        uZenith: { value: new Color(zenithColor) },
        uSunColor: { value: new Color(sunColor) },
        uSunDir: { value: new Vector3(...sunPosition).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDirection;
        void main() {
          // Sphere is centred on the camera, so the local vertex position IS the
          // view direction for this pixel.
          vDirection = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        varying vec3 vDirection;

        void main() {
          vec3 direction = normalize(vDirection);

          // Clamped at 0 so everything at or below the horizon is exactly the
          // horizon colour - the band the fog has to blend into.
          float height = clamp(direction.y, 0.0, 1.0);

          // pow < 1 keeps the gradient tight near the horizon and lets the blue
          // hold across most of the upper sky, instead of washing out.
          vec3 color = mix(uHorizon, uZenith, pow(height, 0.55));

          float sun = max(dot(direction, uSunDir), 0.0);
          color += uSunColor * pow(sun, 240.0) * 1.4;  // the disc
          color += uSunColor * pow(sun, 9.0) * 0.10;   // soft surrounding haze

          gl_FragColor = vec4(color, 1.0);

          // A raw ShaderMaterial does not get these automatically. Without them
          // the sky skips the tone mapping and sRGB conversion every other
          // material goes through, and would not match the fog it has to blend
          // into even with identical input colours.
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
  }, [horizonColor, zenithColor, sunColor, sunPosition]);

  useFrame(({ camera }) => {
    if (groupRef.current) groupRef.current.position.copy(camera.position);
  });

  return (
    <group ref={groupRef}>
      {/* renderOrder -1 draws the backdrop before the scene. */}
      <mesh material={material} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[radius, 32, 16]} />
      </mesh>
    </group>
  );
}
