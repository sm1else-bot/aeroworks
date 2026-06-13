import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useAeroStore } from '../../store';
import { TUNNEL } from '../../types';
import { CarModel } from './CarModel';
import { FieldParticles } from './FieldParticles';
import { FlowRibbons } from './FlowRibbons';
import { Ribbons } from './Ribbons';
import { SmokeProbe } from './SmokeProbe';

/** Working-section outline + translucent inlet/outlet planes. */
function TunnelShell() {
  const { edges, size, center } = useMemo(() => {
    const size = new THREE.Vector3(
      TUNNEL.max.x - TUNNEL.min.x,
      TUNNEL.max.y - TUNNEL.min.y,
      TUNNEL.max.z - TUNNEL.min.z,
    );
    const center = new THREE.Vector3(
      (TUNNEL.max.x + TUNNEL.min.x) / 2,
      (TUNNEL.max.y + TUNNEL.min.y) / 2,
      (TUNNEL.max.z + TUNNEL.min.z) / 2,
    );
    const box = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(box);
    box.dispose();
    return { edges, size, center };
  }, []);

  return (
    <group>
      <lineSegments geometry={edges} position={center}>
        <lineBasicMaterial color="#2a3a55" transparent opacity={0.55} />
      </lineSegments>
      {/* Inlet (cyan) and outlet (amber) planes */}
      <mesh position={[TUNNEL.min.x, center.y, center.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[size.z, size.y]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.045} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[TUNNEL.max.x, center.y, center.z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[size.z, size.y]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.035} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function FlowVisualizer() {
  const flowMode = useAeroStore((s) => s.flowMode);
  return (
    <>
      {flowMode === 'field' && <FieldParticles />}
      {flowMode === 'ribbons' && <Ribbons />}
      {flowMode === 'flow' && <FlowRibbons />}
      {flowMode === 'probe' && <SmokeProbe />}
    </>
  );
}

export function TunnelScene() {
  const showTunnel = useAeroStore((s) => s.showTunnel);
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ position: [-6.2, 3.0, 6.4], fov: 42, near: 0.1, far: 120 }}
      shadows
    >
      <color attach="background" args={['#07090c']} />
      <fog attach="fog" args={['#07090c', 22, 48]} />

      <hemisphereLight args={['#3d4f66', '#0b0d11', 0.85]} />
      <directionalLight
        position={[6, 9, 5]}
        intensity={1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-7, 4, -6]} intensity={0.55} color="#7dd3fc" />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[2, -0.002, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0a0c10" roughness={0.95} metalness={0} />
      </mesh>
      <Grid
        position={[2, 0.002, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellColor="#1a2433"
        sectionSize={2.5}
        sectionColor="#2b3d59"
        fadeDistance={34}
        fadeStrength={1.4}
        infiniteGrid
      />

      {showTunnel && <TunnelShell />}
      <CarModel />
      <FlowVisualizer />

      <OrbitControls
        makeDefault
        target={[0.4, 0.6, 0]}
        maxPolarAngle={Math.PI / 2 - 0.015}
        minDistance={1.6}
        maxDistance={26}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
  );
}
