import { create } from 'zustand';
import * as THREE from 'three';
import type { CarPart, ColorMode, FlowMode, RenderMode } from './types';

export interface AeroState {
  /* ---- environment / solver parameters ---- */
  /** Freestream air speed, km/h. */
  speedKmh: number;
  /** Air density rho, kg/m^3. */
  airDensity: number;
  /** Turbulence / viscosity agitation factor, 0..1. */
  turbulence: number;
  /** Surface slip / restitution coefficient epsilon in the deflection law. */
  slipEpsilon: number;
  /** Number of live particles in the continuous field. */
  particleCount: number;
  /** Particle lifetime, seconds. */
  particleLifetime: number;

  /* ---- visualization state ---- */
  flowMode: FlowMode;
  colorMode: ColorMode;
  renderMode: RenderMode;
  /** Opacity used by the x-ray/ghost render mode, 0..1. */
  ghostOpacity: number;
  showTunnel: boolean;
  paused: boolean;

  /* ---- geometry / active aero ---- */
  parts: CarPart[];
  /** User-set AoA per adjustable part id, degrees. */
  partAngles: Record<string, number>;
  /** DRS: when open, rear-wing elements feather to minimum drag. */
  drsOpen: boolean;
  /** Bumped whenever the part list is replaced (file import / reset). */
  geometryVersion: number;
  /** Bumped whenever an angle changes (triggers field rebuild + telemetry). */
  aeroVersion: number;
  /** Name of the currently loaded model. */
  modelName: string;
  /** Import progress 0..1, or null when idle. */
  importProgress: number | null;
  importError: string | null;

  /* ---- smoke probe (mutated in place by the gizmo, never replaced) ---- */
  probePosition: THREE.Vector3;

  /* ---- actions ---- */
  set: (partial: Partial<AeroState>) => void;
  setParts: (parts: CarPart[], modelName: string) => void;
  setPartAngle: (id: string, deg: number) => void;
  toggleDrs: () => void;
}

/**
 * Effective AoA for a part, accounting for the DRS override on rear-wing
 * elements. Exported so the field builder / telemetry use identical values.
 */
export function effectiveAngleDeg(
  part: CarPart,
  partAngles: Record<string, number>,
  drsOpen: boolean,
): number {
  if (!part.adjustable) return 0;
  const user = partAngles[part.id] ?? part.defaultAngleDeg ?? 0;
  if (drsOpen && part.role === 'wing-rear') {
    // DRS feathers the rear flap toward its minimum-drag stop.
    return part.angleRangeDeg ? part.angleRangeDeg[0] : 0;
  }
  return user;
}

export const useAeroStore = create<AeroState>((set, get) => ({
  speedKmh: 220,
  airDensity: 1.225,
  turbulence: 0.12,
  slipEpsilon: 0.35,
  particleCount: 14000,
  particleLifetime: 6,

  flowMode: 'field',
  colorMode: 'velocity',
  renderMode: 'solid',
  ghostOpacity: 0.28,
  showTunnel: true,
  paused: false,

  parts: [],
  partAngles: {},
  drsOpen: false,
  geometryVersion: 0,
  aeroVersion: 0,
  modelName: '',
  importProgress: null,
  importError: null,

  probePosition: new THREE.Vector3(-3.4, 0.55, 0.85),

  set: (partial) => set(partial),

  setParts: (parts, modelName) => {
    const old = get().parts;
    // Free GPU resources of the geometry being replaced.
    for (const p of old) p.geometry.dispose();
    const partAngles: Record<string, number> = {};
    for (const p of parts) {
      if (p.adjustable) partAngles[p.id] = p.defaultAngleDeg ?? 0;
    }
    set((s) => ({
      parts,
      partAngles,
      modelName,
      drsOpen: false,
      geometryVersion: s.geometryVersion + 1,
      aeroVersion: s.aeroVersion + 1,
      importError: null,
    }));
  },

  setPartAngle: (id, deg) =>
    set((s) => ({
      partAngles: { ...s.partAngles, [id]: deg },
      aeroVersion: s.aeroVersion + 1,
    })),

  toggleDrs: () =>
    set((s) => ({ drsOpen: !s.drsOpen, aeroVersion: s.aeroVersion + 1 })),
}));
