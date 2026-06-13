import type * as THREE from 'three';

/** Visualization mode for the flow field. */
export type FlowMode = 'field' | 'ribbons' | 'flow' | 'probe';

/** Scalar used to color-map particles / streamlines. */
export type ColorMode = 'velocity' | 'pressure' | 'vorticity';

/** Render mode for the car body mesh. */
export type RenderMode = 'solid' | 'pressure' | 'wireframe' | 'xray';

/** Aerodynamic role of a part — drives telemetry coefficient lookup. */
export type AeroRole = 'body' | 'wing-front' | 'wing-rear' | 'floor' | 'wheel';

/**
 * A single rigid component of the model. Adjustable parts rotate about
 * `pivot` along `axis` by the user-controlled angle of attack (degrees).
 */
export interface CarPart {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
  role: AeroRole;
  /** Pivot point (model space) for active-aero rotation. */
  pivot?: THREE.Vector3;
  /** Rotation axis (model space, normalized) for active-aero rotation. */
  axis?: THREE.Vector3;
  /** True if this part exposes an angle-of-attack control. */
  adjustable?: boolean;
  /** Default AoA in degrees for adjustable parts. */
  defaultAngleDeg?: number;
  /** [min, max] AoA range in degrees. */
  angleRangeDeg?: [number, number];
  /** Base material color. */
  color?: string;
}

/** Result of parsing an STL/OBJ file (or building procedural geometry). */
export interface ParsedMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  /** Axis-aligned bounding box of the raw source data. */
  bbox: { min: [number, number, number]; max: [number, number, number] };
  /** Spatial center of the raw source data. */
  center: [number, number, number];
  triangleCount: number;
  vertexCount: number;
  /** True when normals had to be regenerated from face windings. */
  normalsGenerated: boolean;
  sourceFormat: 'stl-binary' | 'stl-ascii' | 'obj' | 'procedural';
}

/** One telemetry frame produced by the aero analytics engine. */
export interface TelemetrySample {
  t: number;
  /** Downforce, Newtons (positive = down). */
  fz: number;
  /** Drag, Newtons. */
  fx: number;
  /** Lift-to-drag efficiency ratio. */
  efficiency: number;
  /** Fraction of total downforce acting on the front axle, 0..1. */
  frontBalance: number;
  /** Projected frontal area, m^2. */
  frontalArea: number;
  /** Projected planform area, m^2. */
  planformArea: number;
  /** Effective lift coefficient. */
  cl: number;
  /** Effective drag coefficient. */
  cd: number;
}

/** Wind-tunnel working-section bounds (world space, meters). */
export const TUNNEL = {
  min: { x: -7, y: 0, z: -3.6 },
  max: { x: 11, y: 4.6, z: 3.6 },
} as const;

/** Target normalized model length after import (meters). */
export const MODEL_TARGET_LENGTH = 4.4;

export const KMH_TO_MS = 1 / 3.6;
