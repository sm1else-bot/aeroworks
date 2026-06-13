import { TransformControls } from '@react-three/drei';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { useAeroStore } from '../../store';
import { TUNNEL } from '../../types';
import { ParticleSim } from './particleSim';
import { ParticleCloud } from './ParticleCloud';

const PROBE_PARTICLES = 3200;

/**
 * Interactive smoke probe: a draggable emitter that releases a dense,
 * localized stream of particles — the digital equivalent of a wind-tunnel
 * smoke wand for tracing flow around individual components.
 */
export function SmokeProbe() {
  const [handle, setHandle] = useState<THREE.Mesh | null>(null);
  const probePosition = useAeroStore((s) => s.probePosition);

  const sim = useMemo(
    () =>
      new ParticleSim(PROBE_PARTICLES, (out, o) => {
        const p = useAeroStore.getState().probePosition;
        // Tight gaussian-ish jitter disc so the stream reads as a wand.
        const r = 0.045 * (Math.random() + Math.random()) * 0.5;
        const a = Math.random() * Math.PI * 2;
        out[o] = p.x + (Math.random() - 0.5) * 0.02;
        out[o + 1] = p.y + r * Math.cos(a);
        out[o + 2] = p.z + r * Math.sin(a);
      }),
    [],
  );

  return (
    <group>
      {handle && (
        <TransformControls
          object={handle}
          mode="translate"
          size={0.55}
          onObjectChange={() => {
            if (!handle) return;
            const p = handle.position;
            p.x = THREE.MathUtils.clamp(p.x, TUNNEL.min.x + 0.3, TUNNEL.max.x - 0.5);
            p.y = THREE.MathUtils.clamp(p.y, 0.04, TUNNEL.max.y - 0.2);
            p.z = THREE.MathUtils.clamp(p.z, TUNNEL.min.z + 0.2, TUNNEL.max.z - 0.2);
            // Mutated in place — the emitter reads it on every respawn.
            useAeroStore.getState().probePosition.copy(p);
          }}
        />
      )}
      <mesh ref={setHandle} position={probePosition.toArray()}>
        <sphereGeometry args={[0.045, 18, 14]} />
        <meshStandardMaterial color="#4A6572" metalness={0.2} roughness={0.5} />
      </mesh>
      <ParticleCloud
        sim={sim}
        size={3.4}
        opacity={1}
        lifetimeScale={0.65}
        fixedCount={PROBE_PARTICLES}
      />
    </group>
  );
}
