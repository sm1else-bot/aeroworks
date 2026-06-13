import { useMemo } from 'react';
import { TUNNEL } from '../../types';
import { ParticleSim } from './particleSim';
import { ParticleCloud } from './ParticleCloud';

export const MAX_FIELD_PARTICLES = 20_000;

/**
 * Continuous-field mode: a uniform inlet-plane emitter feeding up to 20k
 * particles. Emission is biased toward the ground and the tunnel center
 * line where the model actually lives, so particle budget isn't wasted on
 * undisturbed corner flow.
 */
export function FieldParticles() {
  const sim = useMemo(
    () =>
      new ParticleSim(MAX_FIELD_PARTICLES, (out, o) => {
        out[o] = TUNNEL.min.x + Math.random() * 0.6;
        // Ground-biased vertical distribution.
        out[o + 1] = 0.02 + Math.pow(Math.random(), 1.5) * (TUNNEL.max.y - 0.1);
        // Center-biased lateral distribution (triangular blend).
        const u = Math.random(), w = Math.random();
        const tri = (u + w - 1) * TUNNEL.max.z;
        const uni = (u * 2 - 1) * TUNNEL.max.z;
        out[o + 2] = tri * 0.65 + uni * 0.35;
      }),
    [],
  );

  return <ParticleCloud sim={sim} size={2.4} opacity={0.85} />;
}
