import { useEffect, useReducer, useRef } from 'react';
import type { AeroRole, TelemetrySample } from '../types';
import { KMH_TO_MS } from '../types';
import { effectiveAngleDeg, useAeroStore } from '../store';
import { fieldManager } from '../utils/fieldManager';
import type { WorldGeometry } from '../utils/flowField';

/**
 * Aerodynamic analytics engine.
 *
 * Geometry integration (projected areas, wetted area, load centroids) is
 * exact — triangle sums over the world-space soup — and cached per field
 * rebuild since it only changes with geometry / AoA. Per-sample force
 * evaluation is then O(parts):
 *
 *   Fz = 1/2 rho v^2 Az CL(alpha)      (downforce)
 *   Fx = 1/2 rho v^2 Ax CD + q Awet Cf (pressure + skin-friction drag)
 *
 * CL(alpha) uses thin-airfoil lift slope (2 pi e sin a) on a per-role base
 * coefficient with soft stall; Cf is the turbulent flat-plate correlation
 * 0.074 / Re^(1/5) scaled by a surface-roughness factor.
 */

export interface PartBreakdown {
  id: string;
  name: string;
  role: AeroRole;
  alphaDeg: number;
  /** Planform (vertical projection) area, m^2. */
  az: number;
  /** Frontal (streamwise projection) area, m^2. */
  ax: number;
  /** Wetted area, m^2. */
  awet: number;
  /** Streamwise centroid of the lift-producing area, m. */
  centroidX: number;
  cl: number;
  cd: number;
}

interface RoleCoeffs {
  cl0: number;
  /** Lift-slope efficiency on 2*pi*sin(alpha). */
  e: number;
  stallDeg: number;
  cd0: number;
  /** Induced-drag factor: cd += k * cl^2. */
  k: number;
}

const ROLE_COEFFS: Record<AeroRole, RoleCoeffs> = {
  'wing-front': { cl0: 1.05, e: 0.52, stallDeg: 16, cd0: 0.05, k: 0.06 },
  'wing-rear': { cl0: 1.25, e: 0.55, stallDeg: 18, cd0: 0.055, k: 0.065 },
  floor: { cl0: 0.95, e: 0.3, stallDeg: 90, cd0: 0.015, k: 0.01 },
  body: { cl0: 0.07, e: 0, stallDeg: 90, cd0: 0.36, k: 0.02 },
  wheel: { cl0: -0.06, e: 0, stallDeg: 90, cd0: 0.6, k: 0 },
};

const FRONT_AXLE_X = -1.42;
const REAR_AXLE_X = 1.42;
const AIR_VISCOSITY = 1.81e-5;
const REFERENCE_LENGTH = 4.4;
export const HISTORY_LENGTH = 360;

function liftCoefficient(role: AeroRole, alphaDeg: number): number {
  const c = ROLE_COEFFS[role];
  let cl = c.cl0 + 2 * Math.PI * c.e * Math.sin((alphaDeg * Math.PI) / 180);
  if (alphaDeg > c.stallDeg) {
    cl *= Math.max(0.45, 1 - 0.045 * (alphaDeg - c.stallDeg));
  }
  return cl;
}

/** Exact triangle integration of projected areas per part. */
export function computeBreakdown(
  world: WorldGeometry,
  partAngles: Record<string, number>,
  drsOpen: boolean,
): PartBreakdown[] {
  const out: PartBreakdown[] = [];
  const soup = world.soup;
  for (const { part, start, count } of world.ranges) {
    let az = 0, ax = 0, awet = 0, momX = 0;
    for (let t = start; t < start + count; t++) {
      const o = t * 9;
      const abx = soup[o + 3] - soup[o], aby = soup[o + 4] - soup[o + 1], abz = soup[o + 5] - soup[o + 2];
      const acx = soup[o + 6] - soup[o], acy = soup[o + 7] - soup[o + 1], acz = soup[o + 8] - soup[o + 2];
      const nx = aby * acz - abz * acy;
      const ny = abz * acx - abx * acz;
      const nz = abx * acy - aby * acx;
      const twoA = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (twoA < 1e-12) continue;
      const area = twoA / 2;
      // Closed surfaces project both sides; halve for the silhouette.
      const azTri = (Math.abs(ny / twoA) * area) / 2;
      az += azTri;
      ax += (Math.abs(nx / twoA) * area) / 2;
      awet += area;
      momX += azTri * ((soup[o] + soup[o + 3] + soup[o + 6]) / 3);
    }
    const alphaDeg = effectiveAngleDeg(part, partAngles, drsOpen);
    const cl = liftCoefficient(part.role, part.adjustable ? alphaDeg : 0);
    const cd = ROLE_COEFFS[part.role].cd0 + ROLE_COEFFS[part.role].k * cl * cl;
    out.push({
      id: part.id,
      name: part.name,
      role: part.role,
      alphaDeg: part.adjustable ? alphaDeg : 0,
      az,
      ax,
      awet,
      centroidX: az > 1e-9 ? momX / az : 0,
      cl,
      cd,
    });
  }
  return out;
}

export interface PartForces extends PartBreakdown {
  fz: number;
  fx: number;
}

export interface TelemetryState {
  latest: TelemetrySample | null;
  history: TelemetrySample[];
  partForces: PartForces[];
}

/** Evaluates instantaneous forces from a cached breakdown. */
export function evaluateForces(
  breakdown: PartBreakdown[],
  speedMs: number,
  rho: number,
  turbulence: number,
  time: number,
): { sample: TelemetrySample; parts: PartForces[] } {
  const q = 0.5 * rho * speedMs * speedMs;
  const re = Math.max((rho * speedMs * REFERENCE_LENGTH) / AIR_VISCOSITY, 1e4);
  const cf = (0.074 / Math.pow(re, 0.2)) * (1 + 0.55 * turbulence);

  let fz = 0, fx = 0, frontMoment = 0;
  let azTotal = 0, axTotal = 0;
  const parts: PartForces[] = [];
  for (const b of breakdown) {
    // Small stochastic flutter so live traces breathe with turbulence.
    const flutter = 1 + (Math.random() - 0.5) * 0.05 * turbulence
      + 0.012 * turbulence * Math.sin(time * 2.3 + b.centroidX * 3.1);
    const pfz = q * b.az * b.cl * flutter;
    const pfx = (q * b.ax * b.cd + q * b.awet * cf) * flutter;
    fz += pfz;
    fx += pfx;
    azTotal += b.az;
    axTotal += b.ax;
    const share = Math.min(Math.max((REAR_AXLE_X - b.centroidX) / (REAR_AXLE_X - FRONT_AXLE_X), 0), 1);
    frontMoment += pfz * share;
    parts.push({ ...b, fz: pfz, fx: pfx });
  }

  const sample: TelemetrySample = {
    t: time,
    fz,
    fx,
    efficiency: fx > 1e-6 ? fz / fx : 0,
    frontBalance: Math.abs(fz) > 1e-6 ? frontMoment / fz : 0.5,
    frontalArea: axTotal,
    planformArea: azTotal,
    cl: q * azTotal > 1e-6 ? fz / (q * azTotal) : 0,
    cd: q * axTotal > 1e-6 ? fx / (q * axTotal) : 0,
  };
  return { sample, parts };
}

/**
 * Live telemetry: 10 Hz sampling into a rolling ring buffer, with the
 * geometry integration re-cached on every field rebuild (import or active
 * aero change).
 */
export function useAeroTelemetry(): TelemetryState {
  const [, tick] = useReducer((c: number) => c + 1, 0);
  const breakdownRef = useRef<PartBreakdown[]>([]);
  const historyRef = useRef<TelemetrySample[]>([]);
  const partForcesRef = useRef<PartForces[]>([]);
  const latestRef = useRef<TelemetrySample | null>(null);

  useEffect(() => {
    const recache = () => {
      const { partAngles, drsOpen } = useAeroStore.getState();
      if (fieldManager.world) {
        breakdownRef.current = computeBreakdown(fieldManager.world, partAngles, drsOpen);
      }
    };
    recache();
    return fieldManager.subscribe(recache);
  }, []);

  useEffect(() => {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      const s = useAeroStore.getState();
      if (s.paused || breakdownRef.current.length === 0) return;
      const time = (performance.now() - t0) / 1000;
      const { sample, parts } = evaluateForces(
        breakdownRef.current,
        s.speedKmh * KMH_TO_MS,
        s.airDensity,
        s.turbulence,
        time,
      );
      latestRef.current = sample;
      partForcesRef.current = parts;
      // New array reference each tick so React's Object.is detects the change
      // and downstream useCallback/useEffect dependencies re-fire correctly.
      const h = historyRef.current.slice();
      h.push(sample);
      if (h.length > HISTORY_LENGTH) h.splice(0, h.length - HISTORY_LENGTH);
      historyRef.current = h;
      tick();
    }, 100);
    return () => window.clearInterval(id);
  }, []);

  return {
    latest: latestRef.current,
    history: historyRef.current,
    partForces: partForcesRef.current,
  };
}
