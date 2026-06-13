import type { ColorMode } from '../../types';
import { TUNNEL } from '../../types';
import type { FlowField } from '../../utils/flowField';

export interface SimEnv {
  field: FlowField | null;
  time: number;
  /** Freestream speed, m/s. */
  freestream: number;
  turbulence: number;
  epsilon: number;
  colorMode: ColorMode;
  lifetime: number;
}

export type SpawnFn = (out: Float32Array, offset: number) => void;

/**
 * CPU advection core driving a GPU point cloud. Positions / scalars / fade
 * factors live in the exact Float32Arrays bound as buffer attributes, so a
 * step is one pass with zero copies. Midpoint (RK2) integration keeps
 * streaklines smooth through the steep velocity gradients near surfaces.
 */
export class ParticleSim {
  readonly max: number;
  readonly positions: Float32Array;
  readonly scalar: Float32Array;
  readonly fade: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private spawn: SpawnFn;
  private v0 = new Float32Array(3);
  private v1 = new Float32Array(3);
  private frame = 0;
  /** Active particle count (drawRange). */
  count: number;

  constructor(max: number, spawn: SpawnFn, initialCount = max) {
    this.max = max;
    this.count = Math.min(initialCount, max);
    this.positions = new Float32Array(max * 3);
    this.scalar = new Float32Array(max);
    this.fade = new Float32Array(max);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.spawn = spawn;
    for (let i = 0; i < max; i++) this.reset(i, true);
  }

  /** Respawn a particle; on the initial fill, ages are randomized so the
   *  field is fully developed from the first frame instead of pulsing. */
  private reset(i: number, scatterAge = false): void {
    this.spawn(this.positions, i * 3);
    this.life[i] = 1; // rescaled by lifetime in step()
    this.age[i] = scatterAge ? Math.random() : 0;
    this.fade[i] = 0;
  }

  setCount(n: number): void {
    const next = Math.min(Math.max(n, 0), this.max);
    for (let i = this.count; i < next; i++) this.reset(i, true);
    this.count = next;
  }

  step(rawDt: number, env: SimEnv): void {
    const dt = Math.min(rawDt, 1 / 30);
    const { field, freestream } = env;
    if (!field || freestream <= 0.01) return;
    this.frame++;

    const pos = this.positions;
    const lifetime = Math.max(env.lifetime, 0.5);
    const invU = 1 / freestream;
    const vortScale = 1 / (freestream * 2.4);
    const phase = this.frame % 3;

    for (let i = 0; i < this.count; i++) {
      const o = i * 3;
      let x = pos[o], y = pos[o + 1], z = pos[o + 2];

      // Midpoint integration through the field.
      field.velocityAt(x, y, z, env.time, freestream, env.turbulence, env.epsilon, this.v0);
      const hx = x + this.v0[0] * dt * 0.5;
      const hy = y + this.v0[1] * dt * 0.5;
      const hz = z + this.v0[2] * dt * 0.5;
      field.velocityAt(hx, hy, hz, env.time, freestream, env.turbulence, env.epsilon, this.v1);
      x += this.v1[0] * dt;
      y += this.v1[1] * dt;
      z += this.v1[2] * dt;
      if (y < 0.01) y = 0.01;
      pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;

      // Lifecycle.
      this.age[i] += dt / lifetime;
      const expired =
        this.age[i] >= this.life[i] ||
        x > TUNNEL.max.x || x < TUNNEL.min.x - 1 ||
        y > TUNNEL.max.y + 1 || Math.abs(z) > TUNNEL.max.z + 1;
      if (expired) {
        this.reset(i);
        continue;
      }
      const a = this.age[i] / this.life[i];
      this.fade[i] = Math.min(a * 8, 1, (1 - a) * 4);

      // Scalar for the colormap.
      const sx = this.v1[0], sy = this.v1[1], sz = this.v1[2];
      const speed = Math.sqrt(sx * sx + sy * sy + sz * sz);
      switch (env.colorMode) {
        case 'velocity':
          this.scalar[i] = (speed * invU) / 1.45;
          break;
        case 'pressure': {
          // Bernoulli: Cp = 1 - (|v|/U)^2; stagnation -> 1 (red),
          // accelerated suction flow -> negative (blue).
          const cp = 1 - (speed * invU) ** 2;
          this.scalar[i] = (cp + 1.6) / 2.6;
          break;
        }
        case 'vorticity':
          // Curl is 7x the sampling cost — stagger across 3 frames.
          if (i % 3 === phase) {
            const w = field.vorticityAt(x, y, z, env.time, freestream, env.turbulence, env.epsilon);
            this.scalar[i] = w * vortScale;
          }
          break;
      }
    }
  }
}
