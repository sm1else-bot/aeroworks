import { useMemo } from 'react';
import * as THREE from 'three';
import { effectiveAngleDeg, useAeroStore } from '../../store';
import type { CarPart, RenderMode } from '../../types';
import { sampleColormap } from '../../utils/colormap';

/**
 * Static surface-pressure overlay baked into vertex colors. A geometric
 * potential-flow proxy: faces square to the oncoming flow (-X normals)
 * stagnate (Cp -> 1, red); downward-facing cambered surfaces — wing
 * undersides, the floor — carry suction (blue); leeward faces sit at
 * mild base pressure.
 */
function bakePressureColors(geometry: THREE.BufferGeometry): void {
  if (geometry.getAttribute('color')) return;
  const normal = geometry.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(normal.count * 3);
  for (let i = 0; i < normal.count; i++) {
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const stagnation = Math.max(0, -nx) ** 1.4; // windward faces
    const suction = Math.max(0, -ny); // downforce-producing undersides
    const base = Math.max(0, nx) * 0.18; // leeward base pressure deficit
    const s = THREE.MathUtils.clamp(0.52 + 0.48 * stagnation - 0.5 * suction - base, 0, 1);
    sampleColormap(s, colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function PartMaterial({ part, mode, ghostOpacity }: { part: CarPart; mode: RenderMode; ghostOpacity: number }) {
  switch (mode) {
    case 'wireframe':
      return <meshBasicMaterial key="wf" color={part.adjustable ? '#22d3ee' : '#5b7da3'} wireframe transparent opacity={0.55} />;
    case 'xray':
      return (
        <meshStandardMaterial
          key="xr"
          color="#9fd2f5"
          metalness={0.1}
          roughness={0.3}
          transparent
          opacity={ghostOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      );
    case 'pressure':
      return <meshStandardMaterial key="pr" vertexColors metalness={0.05} roughness={0.55} />;
    default:
      return <meshStandardMaterial key="so" color={part.color ?? '#8fa3b8'} metalness={0.35} roughness={0.42} />;
  }
}

function PartMesh({ part }: { part: CarPart }) {
  const renderMode = useAeroStore((s) => s.renderMode);
  const ghostOpacity = useAeroStore((s) => s.ghostOpacity);
  const partAngles = useAeroStore((s) => s.partAngles);
  const drsOpen = useAeroStore((s) => s.drsOpen);

  useMemo(() => {
    if (renderMode === 'pressure') bakePressureColors(part.geometry);
  }, [renderMode, part]);

  const mesh = (
    <mesh
      geometry={part.geometry}
      castShadow
      receiveShadow
      renderOrder={renderMode === 'xray' ? 2 : 0}
      position={
        part.adjustable && part.pivot
          ? [-part.pivot.x, -part.pivot.y, -part.pivot.z]
          : undefined
      }
    >
      <PartMaterial part={part} mode={renderMode} ghostOpacity={ghostOpacity} />
    </mesh>
  );

  if (!part.adjustable || !part.pivot || !part.axis) return mesh;

  // Pivot rig: translate to pivot, rotate by the live AoA, translate back.
  const angle = THREE.MathUtils.degToRad(effectiveAngleDeg(part, partAngles, drsOpen));
  return (
    <group position={part.pivot}>
      <group rotation={[part.axis.x * angle, part.axis.y * angle, part.axis.z * angle]}>
        {mesh}
      </group>
    </group>
  );
}

export function CarModel() {
  const parts = useAeroStore((s) => s.parts);
  return (
    <group>
      {parts.map((p) => (
        <PartMesh key={p.id} part={p} />
      ))}
    </group>
  );
}
