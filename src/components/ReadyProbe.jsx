import { useFrame } from '@react-three/fiber';
import { reportInteractive } from '../lib/metrics';

/**
 * Fires once, on the first frame rendered with the model present.
 *
 * Rendered INSIDE the Suspense boundary on purpose. That guarantees the GLB has
 * downloaded, decoded and been added to the scene before this component exists at
 * all, so its first useFrame is genuinely the first interactive frame rather than
 * the first frame of an empty canvas.
 */
export default function ReadyProbe() {
  useFrame(() => {
    reportInteractive();
  });
  return null;
}
