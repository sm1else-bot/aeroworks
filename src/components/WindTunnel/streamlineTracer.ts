import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useAeroStore } from '../../store';
import { TUNNEL } from '../../types';
import { sampleColormap } from '../../utils/colormap';
import { fieldManager, useFieldVersion } from '../../utils/fieldManager';

/**
 * Shared streamline integration used by both the static Ribbons mode and
 * the animated Flow mode — one tracing path, so the physics stays
 * identical regardless of how the lines are rendered.
 *
 * Output geometry carries three attributes per segment vertex:
 *   position — integrated path points (fixed arc-length steps)
 *   color    — colormap sample for the active scalar mode
 *   aDist    — cumulative arc length along the owning streamline, which
 *              the Flow shader uses as its dash-pattern coordinate
 */

export const MAX_STEPS = 420;
export const ARC_STEP = 0.055;
/** The field is linear in freestream, so any U traces the same lines. */
const TRACE_U = 50;

/** Inlet seed rake: dense near the ground / center line, sparse high up. */
function buildSeeds(): Array<[number, number, number]> {
  const seeds: Array<[number, number, number]> = [];
  const rows: Array<{ y: number; n: number; halfZ: number }> = [
    { y: 0.07, n: 15, halfZ: 1.35 },
    { y: 0.22, n: 15, halfZ: 1.3 },
    { y: 0.42, n: 13, halfZ: 1.2 },
    { y: 0.68, n: 11, halfZ: 1.1 },
    { y: 1.0, n: 9, halfZ: 1.0 },
    { y: 1.35, n: 7, halfZ: 0.95 },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const z = row.n === 1 ? 0 : -row.halfZ + (2 * row.halfZ * i) / (row.n - 1);
      seeds.push([TUNNEL.min.x + 0.25, row.y, z]);
    }
  }
  return seeds;
}

/**
 * Integrates the seed rake through the current velocity field and returns
 * a ready-to-render LineSegments geometry. Retraces when the field is
 * rebuilt or a parameter that bends the paths / recolors them changes;
 * the previous geometry is disposed automatically, so mode toggling and
 * retraces never leak GPU buffers.
 */
export function useStreamlineGeometry(): THREE.BufferGeometry {
  const fieldVersion = useFieldVersion();
  const turbulence = useAeroStore((s) => s.turbulence);
  const slipEpsilon = useAeroStore((s) => s.slipEpsilon);
  const colorMode = useAeroStore((s) => s.colorMode);

  const geometry = useMemo(() => {
    const field = fieldManager.field;
    const seeds = buildSeeds();
    const maxVerts = seeds.length * MAX_STEPS * 2;
    const positions = new Float32Array(maxVerts * 3);
    const colors = new Float32Array(maxVerts * 3);
    const dists = new Float32Array(maxVerts);
    let cursor = 0;
    const v = new Float32Array(3);

    if (field) {
      const invU = 1 / TRACE_U;
      const vortScale = 1 / (TRACE_U * 2.4);
      for (const [sx, sy, sz] of seeds) {
        let x = sx, y = sy, z = sz;
        for (let step = 0; step < MAX_STEPS; step++) {
          field.velocityAt(x, y, z, 0, TRACE_U, turbulence, slipEpsilon, v);
          const speed = Math.hypot(v[0], v[1], v[2]);
          if (speed < TRACE_U * 0.02) break;
          const nx = x + (v[0] / speed) * ARC_STEP;
          const ny = Math.max(y + (v[1] / speed) * ARC_STEP, 0.01);
          const nz = z + (v[2] / speed) * ARC_STEP;

          let scalar: number;
          if (colorMode === 'velocity') {
            scalar = (speed * invU) / 1.45;
          } else if (colorMode === 'pressure') {
            scalar = (1 - (speed * invU) ** 2 + 1.6) / 2.6;
          } else {
            scalar = field.vorticityAt(x, y, z, 0, TRACE_U, turbulence, slipEpsilon) * vortScale;
          }

          const o = cursor * 3;
          positions[o] = x; positions[o + 1] = y; positions[o + 2] = z;
          positions[o + 3] = nx; positions[o + 4] = ny; positions[o + 5] = nz;
          sampleColormap(scalar, colors, o);
          sampleColormap(scalar, colors, o + 3);
          dists[cursor] = step * ARC_STEP;
          dists[cursor + 1] = (step + 1) * ARC_STEP;
          cursor += 2;

          x = nx; y = ny; z = nz;
          if (x > TUNNEL.max.x - 0.1 || Math.abs(z) > TUNNEL.max.z || y > TUNNEL.max.y) break;
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aDist', new THREE.BufferAttribute(dists, 1));
    geo.setDrawRange(0, cursor);
    return geo;
    // fieldVersion is the rebuild signal even though the field is read
    // through the manager singleton.
  }, [fieldVersion, turbulence, slipEpsilon, colorMode]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return geometry;
}
