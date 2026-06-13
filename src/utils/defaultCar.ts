import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarPart } from '../types';
import { generateSmoothNormals } from './parsers';

/**
 * Procedural multi-element open-wheel chassis so the workspace functions
 * instantly on boot: nose cone, front wing mainplane + two active flaps,
 * floor with diffuser, rear wing mainplane + DRS flap + endplates, wheels.
 *
 * Conventions: air flows along +X, so the nose sits at negative X. Ground
 * plane is y = 0. Adjustable wing elements are modeled at 0 deg AoA; the
 * live angle is applied as a rotation about their pivot at render /
 * solve time. Positive AoA pitches the trailing edge up (more downforce
 * on an inverted profile).
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function stripUv(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  geo.deleteAttribute('uv');
  return geo;
}

/**
 * Box whose cross-section (width, height, vertical center) interpolates
 * linearly from x0 to x1 — used for the nose cone and engine cover.
 */
function taperedBox(opts: {
  x0: number; x1: number;
  w0: number; h0: number; cy0: number;
  w1: number; h1: number; cy1: number;
  segments?: number;
}): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(1, 1, 1, opts.segments ?? 4, 1, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getX(i) + 0.5;
    pos.setXYZ(
      i,
      lerp(opts.x0, opts.x1, t),
      lerp(opts.cy0, opts.cy1, t) + pos.getY(i) * lerp(opts.h0, opts.h1, t),
      pos.getZ(i) * lerp(opts.w0, opts.w1, t),
    );
  }
  geo.computeVertexNormals();
  return stripUv(geo);
}

function box(
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  rotZ = 0,
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (rotZ !== 0) geo.rotateZ(rotZ);
  geo.translate(x, y, z);
  return stripUv(geo);
}

/**
 * Inverted NACA-style airfoil extruded along the span (Z axis). Chord runs
 * +X with the leading edge at the local origin and the chord line at y = 0.
 * Thickness uses the NACA 4-digit half-thickness polynomial; camber is a
 * parabolic mean line flipped to produce downforce.
 */
export function airfoilGeometry(
  chord: number,
  span: number,
  thicknessRatio = 0.11,
  camberRatio = 0.07,
  chordSegments = 14,
): THREE.BufferGeometry {
  const n = chordSegments;
  const loop: Array<[number, number]> = [];
  const profile = (i: number) => {
    const xc = 0.5 - 0.5 * Math.cos((Math.PI * i) / n); // cosine spacing
    const yt =
      5 * thicknessRatio *
      (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc ** 2 +
        0.2843 * xc ** 3 - 0.1036 * xc ** 4);
    const yc = -4 * camberRatio * xc * (1 - xc); // inverted camber line
    return { x: xc * chord, top: (yc + yt) * chord, bot: (yc - yt) * chord };
  };
  for (let i = 0; i <= n; i++) {
    const p = profile(i);
    loop.push([p.x, p.top]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const p = profile(i);
    loop.push([p.x, p.bot]);
  }

  const L = loop.length;
  const half = span / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  // Two rings forming the side walls.
  for (const [x, y] of loop) positions.push(x, y, -half);
  for (const [x, y] of loop) positions.push(x, y, half);
  for (let j = 0; j < L; j++) {
    const j2 = (j + 1) % L;
    const a = j, b = j2, c = L + j2, d = L + j;
    indices.push(a, c, b, a, d, c);
  }

  // Duplicated cap rings so end faces stay crisp after normal smoothing.
  let cx = 0, cy = 0;
  for (const [x, y] of loop) { cx += x; cy += y; }
  cx /= L; cy /= L;
  for (const side of [-1, 1] as const) {
    const base = positions.length / 3;
    for (const [x, y] of loop) positions.push(x, y, side * half);
    const centerIdx = positions.length / 3;
    positions.push(cx, cy, side * half);
    for (let j = 0; j < L; j++) {
      const j2 = (j + 1) % L;
      if (side < 0) indices.push(base + j, base + j2, centerIdx);
      else indices.push(base + j2, base + j, centerIdx);
    }
  }

  const posArr = new Float32Array(positions);
  const idxArr = new Uint32Array(indices);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(generateSmoothNormals(posArr, idxArr), 3));
  geo.setIndex(new THREE.BufferAttribute(idxArr, 1));
  return geo;
}

function wheel(x: number, z: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.33, 0.33, 0.3, 20);
  geo.rotateX(Math.PI / 2);
  geo.translate(x, 0.33, z);
  return stripUv(geo);
}

function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

export function createDefaultCar(): CarPart[] {
  const parts: CarPart[] = [];

  /* ---------------- chassis: nose cone + tub + sidepods + cover ----- */
  const nose = taperedBox({
    x0: -2.2, x1: -1.15,
    w0: 0.13, h0: 0.13, cy0: 0.34,
    w1: 0.42, h1: 0.3, cy1: 0.42,
  });
  const tub = taperedBox({
    x0: -1.15, x1: 0.45,
    w0: 0.46, h0: 0.34, cy0: 0.42,
    w1: 0.62, h1: 0.42, cy1: 0.45,
  });
  const cockpit = taperedBox({
    x0: -0.55, x1: 0.5,
    w0: 0.3, h0: 0.18, cy0: 0.68,
    w1: 0.4, h1: 0.26, cy1: 0.62,
  });
  const sidepodL = taperedBox({
    x0: -0.15, x1: 1.35, w0: 0.34, h0: 0.3, cy0: 0.32,
    w1: 0.2, h1: 0.18, cy1: 0.26,
  });
  sidepodL.translate(0, 0, 0.52);
  const sidepodR = sidepodL.clone();
  sidepodR.translate(0, 0, -1.04);
  const engineCover = taperedBox({
    x0: 0.45, x1: 1.95,
    w0: 0.4, h0: 0.46, cy0: 0.5,
    w1: 0.12, h1: 0.16, cy1: 0.42,
  });
  const airbox = taperedBox({
    x0: 0.3, x1: 0.95, w0: 0.22, h0: 0.2, cy0: 0.82,
    w1: 0.14, h1: 0.12, cy1: 0.7,
  });
  parts.push({
    id: 'chassis',
    name: 'Chassis & Nose Cone',
    geometry: merge([nose, tub, cockpit, sidepodL, sidepodR, engineCover, airbox]),
    role: 'body',
    color: '#c2303b',
  });

  /* ---------------- floor + diffuser -------------------------------- */
  const floorPlate = box(3.0, 0.05, 1.5, 0.15, 0.085, 0);
  const diffuser = box(0.8, 0.05, 1.3, 2.0, 0.22, 0, 0.32);
  parts.push({
    id: 'floor',
    name: 'Floor & Diffuser',
    geometry: merge([floorPlate, diffuser]),
    role: 'floor',
    color: '#11151b',
  });

  /* ---------------- front wing -------------------------------------- */
  const fwMain = airfoilGeometry(0.46, 1.84, 0.1, 0.075, 14);
  fwMain.rotateZ(THREE.MathUtils.degToRad(4));
  fwMain.translate(-2.18, 0.14, 0);
  const fwEpL = box(0.5, 0.26, 0.024, -1.96, 0.22, 0.93);
  const fwEpR = box(0.5, 0.26, 0.024, -1.96, 0.22, -0.93);
  parts.push({
    id: 'front-wing-main',
    name: 'Front Wing Mainplane',
    geometry: merge([fwMain, fwEpL, fwEpR]),
    role: 'wing-front',
    color: '#171c23',
  });

  // Two active flaps modeled at 0 deg AoA; live AoA rotates about the
  // quarter-chord pivot at solve / render time.
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? 1 : -1;
    const flap = airfoilGeometry(0.3, 0.74, 0.1, 0.07, 12);
    const le = new THREE.Vector3(-1.88, 0.3, sign * 0.5);
    flap.translate(le.x, le.y, le.z - 0); // span already centered on z=0
    parts.push({
      id: `front-flap-${side}`,
      name: `Front Flap ${side === 'left' ? 'L' : 'R'}`,
      geometry: flap,
      role: 'wing-front',
      pivot: new THREE.Vector3(le.x + 0.075, le.y, le.z),
      axis: new THREE.Vector3(0, 0, 1),
      adjustable: true,
      defaultAngleDeg: 14,
      angleRangeDeg: [0, 32],
      color: '#22d3ee',
    });
  }

  /* ---------------- rear wing --------------------------------------- */
  const rwMain = airfoilGeometry(0.5, 1.42, 0.11, 0.08, 14);
  rwMain.rotateZ(THREE.MathUtils.degToRad(9));
  rwMain.translate(1.5, 0.92, 0);
  const beamWing = airfoilGeometry(0.3, 1.3, 0.12, 0.06, 10);
  beamWing.rotateZ(THREE.MathUtils.degToRad(12));
  beamWing.translate(1.72, 0.62, 0);
  const rwEpL = box(0.74, 0.56, 0.024, 1.82, 0.95, 0.73);
  const rwEpR = box(0.74, 0.56, 0.024, 1.82, 0.95, -0.73);
  parts.push({
    id: 'rear-wing-main',
    name: 'Rear Wing Mainplane & Endplates',
    geometry: merge([rwMain, beamWing, rwEpL, rwEpR]),
    role: 'wing-rear',
    color: '#171c23',
  });

  const drsFlap = airfoilGeometry(0.34, 1.38, 0.1, 0.065, 12);
  const drsLe = new THREE.Vector3(1.74, 1.14, 0);
  drsFlap.translate(drsLe.x, drsLe.y, drsLe.z);
  parts.push({
    id: 'rear-flap',
    name: 'Rear Flap (DRS)',
    geometry: drsFlap,
    role: 'wing-rear',
    pivot: new THREE.Vector3(drsLe.x + 0.085, drsLe.y, 0),
    axis: new THREE.Vector3(0, 0, 1),
    adjustable: true,
    defaultAngleDeg: 22,
    angleRangeDeg: [2, 40],
    color: '#22d3ee',
  });

  /* ---------------- wheels ------------------------------------------ */
  parts.push({
    id: 'wheels',
    name: 'Wheels',
    geometry: merge([
      wheel(-1.42, 0.79), wheel(-1.42, -0.79),
      wheel(1.42, 0.81), wheel(1.42, -0.81),
    ]),
    role: 'wheel',
    color: '#101317',
  });

  return parts;
}
