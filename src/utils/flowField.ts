import * as THREE from 'three';
import type { CarPart } from '../types';
import { effectiveAngleDeg } from '../store';

/**
 * Velocity-field engine.
 *
 * A distance/normal voxel grid is baked from the model's triangles via a
 * spatial hash (cells seeded with exact closest-point-on-triangle queries,
 * then propagated outward with Gauss-Seidel sweeps). Per-frame sampling is
 * therefore O(1) per particle, which is what lets 20k particles advect at
 * 60 FPS without per-particle raycasts.
 *
 * Deflection law — when a particle is inside the boundary-layer influence
 * band and moving toward the surface, its velocity is reflected against the
 * local surface normal:
 *
 *   v' = v - (1 + eps) * (v . n) * n
 *
 * blended by proximity so the turn is gradual at the band's outer edge and
 * fully resolved at the wall. `eps` is the configurable slip/restitution
 * coefficient.
 */

export interface WorldGeometry {
  /** Triangle soup, world space: 9 floats per triangle. */
  soup: Float32Array;
  /** Triangle ranges per part (start/count in triangles). */
  ranges: Array<{ part: CarPart; start: number; count: number }>;
}

/** Applies live AoA rotations and flattens all parts to a world-space soup. */
export function collectWorldTriangles(
  parts: CarPart[],
  partAngles: Record<string, number>,
  drsOpen: boolean,
): WorldGeometry {
  let triTotal = 0;
  for (const p of parts) {
    const idx = p.geometry.getIndex();
    triTotal += (idx ? idx.count : p.geometry.attributes.position.count) / 3;
  }
  const soup = new Float32Array(triTotal * 9);
  const ranges: WorldGeometry['ranges'] = [];
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let triCursor = 0;

  for (const part of parts) {
    const angle = effectiveAngleDeg(part, partAngles, drsOpen);
    if (part.adjustable && part.pivot && part.axis && angle !== 0) {
      m.makeRotationAxis(part.axis, THREE.MathUtils.degToRad(angle));
      m.setPosition(
        part.pivot.x - (m.elements[0] * part.pivot.x + m.elements[4] * part.pivot.y + m.elements[8] * part.pivot.z),
        part.pivot.y - (m.elements[1] * part.pivot.x + m.elements[5] * part.pivot.y + m.elements[9] * part.pivot.z),
        part.pivot.z - (m.elements[2] * part.pivot.x + m.elements[6] * part.pivot.y + m.elements[10] * part.pivot.z),
      );
    } else {
      m.identity();
    }
    const pos = part.geometry.attributes.position as THREE.BufferAttribute;
    const index = part.geometry.getIndex();
    const triCount = (index ? index.count : pos.count) / 3;
    const start = triCursor;
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) {
        const vi = index ? index.getX(t * 3 + k) : t * 3 + k;
        v.fromBufferAttribute(pos, vi).applyMatrix4(m);
        const o = (triCursor + t) * 9 + k * 3;
        soup[o] = v.x; soup[o + 1] = v.y; soup[o + 2] = v.z;
      }
    }
    ranges.push({ part, start, count: triCount });
    triCursor += triCount;
  }
  return { soup, ranges };
}

/* ------------------------------------------------------------------ */
/* Closest point on triangle (Ericson, Real-Time Collision Detection)  */
/* ------------------------------------------------------------------ */

const _scratch = {
  ab: [0, 0, 0], ac: [0, 0, 0], ap: [0, 0, 0], bp: [0, 0, 0], cp: [0, 0, 0],
};

function closestPointOnTriangle(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  out: [number, number, number],
): void {
  const s = _scratch;
  s.ab[0] = bx - ax; s.ab[1] = by - ay; s.ab[2] = bz - az;
  s.ac[0] = cx - ax; s.ac[1] = cy - ay; s.ac[2] = cz - az;
  s.ap[0] = px - ax; s.ap[1] = py - ay; s.ap[2] = pz - az;

  const d1 = s.ab[0] * s.ap[0] + s.ab[1] * s.ap[1] + s.ab[2] * s.ap[2];
  const d2 = s.ac[0] * s.ap[0] + s.ac[1] * s.ap[1] + s.ac[2] * s.ap[2];
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return; }

  s.bp[0] = px - bx; s.bp[1] = py - by; s.bp[2] = pz - bz;
  const d3 = s.ab[0] * s.bp[0] + s.ab[1] * s.bp[1] + s.ab[2] * s.bp[2];
  const d4 = s.ac[0] * s.bp[0] + s.ac[1] * s.bp[1] + s.ac[2] * s.bp[2];
  if (d3 >= 0 && d4 <= d3) { out[0] = bx; out[1] = by; out[2] = bz; return; }

  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const t = d1 / (d1 - d3);
    out[0] = ax + t * s.ab[0]; out[1] = ay + t * s.ab[1]; out[2] = az + t * s.ab[2];
    return;
  }

  s.cp[0] = px - cx; s.cp[1] = py - cy; s.cp[2] = pz - cz;
  const d5 = s.ab[0] * s.cp[0] + s.ab[1] * s.cp[1] + s.ab[2] * s.cp[2];
  const d6 = s.ac[0] * s.cp[0] + s.ac[1] * s.cp[1] + s.ac[2] * s.cp[2];
  if (d6 >= 0 && d5 <= d6) { out[0] = cx; out[1] = cy; out[2] = cz; return; }

  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const t = d2 / (d2 - d6);
    out[0] = ax + t * s.ac[0]; out[1] = ay + t * s.ac[1]; out[2] = az + t * s.ac[2];
    return;
  }

  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const t = (d4 - d3) / (d4 - d3 + (d5 - d6));
    out[0] = bx + t * (cx - bx); out[1] = by + t * (cy - by); out[2] = bz + t * (cz - bz);
    return;
  }

  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  out[0] = ax + s.ab[0] * v + s.ac[0] * w;
  out[1] = ay + s.ab[1] * v + s.ac[1] * w;
  out[2] = az + s.ab[2] * v + s.ac[2] * w;
}

/* ------------------------------------------------------------------ */
/* Flow field                                                          */
/* ------------------------------------------------------------------ */

const MAX_GRID_VOXELS = 480_000;

export class FlowField {
  /** Boundary-layer influence band, world units. */
  readonly influence: number;
  private nx = 0; private ny = 0; private nz = 0;
  private ox = 0; private oy = 0; private oz = 0;
  private cell = 0.08;
  private dist!: Float32Array;
  private norm!: Float32Array;
  private maxDist = 0;

  private constructor(influence: number) {
    this.influence = influence;
  }

  /**
   * Bakes the distance/normal grid for a world-space triangle soup. The
   * grid covers the model AABB padded by the influence band.
   */
  static build(soup: Float32Array, influence = 0.5): FlowField {
    const f = new FlowField(influence);
    const triCount = soup.length / 9;

    // Model bounds.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < soup.length; i += 3) {
      if (soup[i] < minX) minX = soup[i];
      if (soup[i] > maxX) maxX = soup[i];
      if (soup[i + 1] < minY) minY = soup[i + 1];
      if (soup[i + 1] > maxY) maxY = soup[i + 1];
      if (soup[i + 2] < minZ) minZ = soup[i + 2];
      if (soup[i + 2] > maxZ) maxZ = soup[i + 2];
    }
    if (triCount === 0) {
      f.nx = f.ny = f.nz = 1;
      f.dist = new Float32Array([1e9]);
      f.norm = new Float32Array([0, 1, 0]);
      f.maxDist = 1e9;
      return f;
    }

    // Pad by the influence band plus extra room for wake queries.
    const pad = influence + 0.25;
    minX -= pad; minY = Math.max(minY - pad, -0.05); minZ -= pad;
    maxX += pad + 1.2; maxY += pad; maxZ += pad; // extra tail room for wake
    let cell = 0.08;
    let nx: number, ny: number, nz: number;
    for (;;) {
      nx = Math.ceil((maxX - minX) / cell);
      ny = Math.ceil((maxY - minY) / cell);
      nz = Math.ceil((maxZ - minZ) / cell);
      if (nx * ny * nz <= MAX_GRID_VOXELS) break;
      cell *= 1.25;
    }
    f.cell = cell;
    f.nx = nx; f.ny = ny; f.nz = nz;
    f.ox = minX; f.oy = minY; f.oz = minZ;

    const total = nx * ny * nz;
    const FAR = (nx + ny + nz) * cell;
    f.maxDist = FAR;
    const dist = new Float32Array(total).fill(FAR);
    const norm = new Float32Array(total * 3);
    f.dist = dist;
    f.norm = norm;

    // ---- seed pass: exact closest-point distances near each triangle ----
    const cp: [number, number, number] = [0, 0, 0];
    const seedPad = 1; // cells around each triangle's AABB
    for (let t = 0; t < triCount; t++) {
      const o = t * 9;
      const ax = soup[o], ay = soup[o + 1], az = soup[o + 2];
      const bx = soup[o + 3], by = soup[o + 4], bz = soup[o + 5];
      const cx = soup[o + 6], cy = soup[o + 7], cz = soup[o + 8];

      // Face normal (winding-based, used as fallback orientation).
      let fnx = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      let fny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
      let fnz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const fl = Math.hypot(fnx, fny, fnz);
      if (fl < 1e-12) continue;
      fnx /= fl; fny /= fl; fnz /= fl;

      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - minX) / cell) - seedPad);
      const i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - minX) / cell) + seedPad);
      const j0 = Math.max(0, Math.floor((Math.min(ay, by, cy) - minY) / cell) - seedPad);
      const j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - minY) / cell) + seedPad);
      const k0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - minZ) / cell) - seedPad);
      const k1 = Math.min(nz - 1, Math.floor((Math.max(az, bz, cz) - minZ) / cell) + seedPad);

      for (let i = i0; i <= i1; i++) {
        const px = minX + (i + 0.5) * cell;
        for (let j = j0; j <= j1; j++) {
          const py = minY + (j + 0.5) * cell;
          for (let k = k0; k <= k1; k++) {
            const pz = minZ + (k + 0.5) * cell;
            closestPointOnTriangle(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz, cp);
            const dx = px - cp[0], dy = py - cp[1], dz = pz - cp[2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const vi = (i * ny + j) * nz + k;
            if (d < dist[vi]) {
              dist[vi] = d;
              if (d > cell * 1e-3) {
                // Orient the stored normal away from the surface toward the
                // cell — robust against inconsistent winding in imports.
                norm[vi * 3] = dx / d; norm[vi * 3 + 1] = dy / d; norm[vi * 3 + 2] = dz / d;
              } else {
                norm[vi * 3] = fnx; norm[vi * 3 + 1] = fny; norm[vi * 3 + 2] = fnz;
              }
            }
          }
        }
      }
    }

    // ---- propagation: Gauss-Seidel sweeps spread distance + normal ----
    const relax = (vi: number, vn: number, step: number) => {
      const cand = dist[vn] + step;
      if (cand < dist[vi]) {
        dist[vi] = cand;
        norm[vi * 3] = norm[vn * 3];
        norm[vi * 3 + 1] = norm[vn * 3 + 1];
        norm[vi * 3 + 2] = norm[vn * 3 + 2];
      }
    };
    const sx = ny * nz, sy = nz, sz = 1;
    for (let pass = 0; pass < 2; pass++) {
      // forward
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
        const vi = i * sx + j * sy + k;
        if (i > 0) relax(vi, vi - sx, cell);
        if (j > 0) relax(vi, vi - sy, cell);
        if (k > 0) relax(vi, vi - sz, cell);
      }
      // backward
      for (let i = nx - 1; i >= 0; i--) for (let j = ny - 1; j >= 0; j--) for (let k = nz - 1; k >= 0; k--) {
        const vi = i * sx + j * sy + k;
        if (i < nx - 1) relax(vi, vi + sx, cell);
        if (j < ny - 1) relax(vi, vi + sy, cell);
        if (k < nz - 1) relax(vi, vi + sz, cell);
      }
    }
    return f;
  }

  /** Nearest-surface distance at a point (maxDist when outside the grid). */
  distanceAt(x: number, y: number, z: number): number {
    const i = Math.floor((x - this.ox) / this.cell);
    const j = Math.floor((y - this.oy) / this.cell);
    const k = Math.floor((z - this.oz) / this.cell);
    if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) {
      return this.maxDist;
    }
    return this.dist[(i * this.ny + j) * this.nz + k];
  }

  /**
   * Velocity at a point: freestream along +X, deflected by nearby surfaces,
   * agitated by turbulence (amplified in the wake). Writes into `out`
   * [vx, vy, vz] and returns the surface proximity weight (0 = free air).
   */
  velocityAt(
    x: number, y: number, z: number,
    time: number,
    freestream: number,
    turbulence: number,
    epsilon: number,
    out: Float32Array | number[],
  ): number {
    let vx = freestream, vy = 0, vz = 0;

    const i = Math.floor((x - this.ox) / this.cell);
    const j = Math.floor((y - this.oy) / this.cell);
    const k = Math.floor((z - this.oz) / this.cell);
    let proximity = 0;

    if (i >= 0 && j >= 0 && k >= 0 && i < this.nx && j < this.ny && k < this.nz) {
      const vi = (i * this.ny + j) * this.nz + k;
      const d = this.dist[vi];
      if (d < this.influence) {
        const nx = this.norm[vi * 3], ny = this.norm[vi * 3 + 1], nz = this.norm[vi * 3 + 2];
        proximity = 1 - d / this.influence;
        const w = proximity * proximity * (3 - 2 * proximity); // smoothstep
        const vDotN = vx * nx + vy * ny + vz * nz;
        if (vDotN < 0) {
          // v' = v - (1 + eps)(v.n)n, blended by proximity.
          const s = (1 + epsilon) * vDotN * w;
          vx -= s * nx; vy -= s * ny; vz -= s * nz;
        }
        // Hard push-out inside the wall band prevents tunneling.
        if (d < this.influence * 0.18) {
          const push = freestream * 0.9 * (1 - d / (this.influence * 0.18));
          vx += nx * push; vy += ny * push; vz += nz * push;
        }
        // Skin friction slows flow inside the boundary layer.
        const drag = 1 - 0.45 * w * (1 - epsilon * 0.5);
        vx *= drag; vy *= drag; vz *= drag;
      }

      // Wake heuristic: surface upstream of this point means separated flow.
      const ui = i - Math.max(1, Math.round(0.9 / this.cell));
      if (ui >= 0) {
        const ud = this.dist[(ui * this.ny + j) * this.nz + k];
        if (ud < this.influence * 0.5) {
          const wake = 1 - ud / (this.influence * 0.5);
          // Velocity deficit + recirculation shear in the wake.
          vx *= 1 - 0.55 * wake;
          const swirl = Math.sin(7.1 * y + 5.3 * z + time * 4.1) * wake;
          vy += freestream * 0.16 * swirl;
          vz += freestream * 0.16 * Math.cos(6.3 * y - 4.7 * z + time * 3.7) * wake;
          proximity = Math.max(proximity, wake * 0.8);
        }
      }
    }

    if (turbulence > 0) {
      // Cheap divergence-poor agitation: two phase-shifted trig octaves.
      const a = turbulence * freestream * 0.085 * (1 + 2.2 * proximity);
      vy += a * (Math.sin(2.9 * x + 1.9 * time) * Math.cos(2.1 * z + 1.3 * time));
      vz += a * (Math.sin(2.3 * x - 1.5 * time + 2.0) * Math.cos(2.7 * y + 1.1 * time));
      vx += a * 0.5 * Math.sin(1.7 * y + 2.3 * z + 1.7 * time);
    }

    out[0] = vx; out[1] = vy; out[2] = vz;
    return proximity;
  }

  private static _va = new Float32Array(3);
  private static _vb = new Float32Array(3);

  /**
   * Vorticity magnitude |curl v| via central differences — drives the
   * wake-turbulence color mode.
   */
  vorticityAt(
    x: number, y: number, z: number,
    time: number, freestream: number, turbulence: number, epsilon: number,
  ): number {
    const h = this.cell;
    const a = FlowField._va, b = FlowField._vb;
    this.velocityAt(x, y + h, z, time, freestream, turbulence, epsilon, a);
    this.velocityAt(x, y - h, z, time, freestream, turbulence, epsilon, b);
    const dvz_dy = (a[2] - b[2]) / (2 * h);
    const dvx_dy = (a[0] - b[0]) / (2 * h);
    this.velocityAt(x, y, z + h, time, freestream, turbulence, epsilon, a);
    this.velocityAt(x, y, z - h, time, freestream, turbulence, epsilon, b);
    const dvy_dz = (a[1] - b[1]) / (2 * h);
    const dvx_dz = (a[0] - b[0]) / (2 * h);
    this.velocityAt(x + h, y, z, time, freestream, turbulence, epsilon, a);
    this.velocityAt(x - h, y, z, time, freestream, turbulence, epsilon, b);
    const dvy_dx = (a[1] - b[1]) / (2 * h);
    const dvz_dx = (a[2] - b[2]) / (2 * h);
    const cx = dvz_dy - dvy_dz;
    const cy = dvx_dz - dvz_dx;
    const cz = dvy_dx - dvx_dy;
    return Math.sqrt(cx * cx + cy * cy + cz * cz);
  }
}
