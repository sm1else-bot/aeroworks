import { useStreamlineGeometry } from './streamlineTracer';

/**
 * Ribbon-vector mode: static streamlines integrated through the velocity
 * field. Laminar regions read as straight colored rails; separation and
 * wake shear show up as twisting, kinked lines. The material is declared
 * in JSX so R3F disposes it on unmount; the traced geometry disposes
 * itself inside useStreamlineGeometry.
 */
export function Ribbons() {
  const geometry = useStreamlineGeometry();
  return (
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.85} />
    </lineSegments>
  );
}
