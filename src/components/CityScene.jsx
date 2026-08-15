import CityModel from './CityModel';
import CameraRig from './CameraRig';

export default function CityScene() {
  return (
    <>
      {/* Ambient fills the shadowed sides so unlit faces stay readable rather than
          going black. Directional gives a consistent sun direction, which is what
          actually makes the building massing legible. */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={1.5} />

      <CityModel />

      {/* Owns OrbitControls, the WASD fly rig, the opening framing and reset. */}
      <CameraRig />
    </>
  );
}
