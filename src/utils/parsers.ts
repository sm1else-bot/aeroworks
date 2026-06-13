import * as THREE from 'three';
import type { CarPart, ParsedMesh } from '../types';
import { MODEL_TARGET_LENGTH } from '../types';

/**
 * File ingestion & mesh-processing pipeline.
 *
 * Supports binary STL, ASCII STL and ASCII OBJ. Large files are parsed in
 * chunks with the event loop yielded between slices so the UI thread never
 * locks; progress is reported through an optional callback.
 */

export type ProgressFn = (fraction: number) => void;

const CHUNK_TRIANGLES = 25_000;
const CHUNK_LINES = 20_000;

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));

/* ------------------------------------------------------------------ */
/* Format detection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Binary STL: 80-byte header + uint32 triangle count + 50 bytes/triangle.
 * The byte-length check is authoritative — ASCII files that happen to start
 * with "solid" are common, and binary files sometimes start with "solid" too.
 */
export function detectSTLFormat(buffer: ArrayBuffer): 'stl-binary' | 'stl-ascii' {
  if (buffer.byteLength < 84) return 'stl-ascii';
  const view = new DataView(buffer);
  const triCount = view.getUint32(80, true);
  if (84 + triCount * 50 === buffer.byteLength && triCount > 0) return 'stl-binary';
  // Fall back to sniffing the head for ASCII keywords.
  const head = new TextDecoder().decode(buffer.slice(0, 512)).toLowerCase();
  return head.includes('facet') || head.trimStart().startsWith('solid')
    ? 'stl-ascii'
    : 'stl-binary';
}

/* ------------------------------------------------------------------ */
/* Vertex welding                                                      */
/* ------------------------------------------------------------------ */

/**
 * Welds a triangle soup into an indexed mesh. Coordinates are quantized to
 * a tolerance derived from the model diagonal so coincident corners merge,
 * which is required for smooth vertex-normal generation on STL data.
 */
class VertexWelder {
  private map = new Map<string, number>();
  private positions: number[] = [];
  private quant: number;

  constructor(approxScale: number) {
    this.quant = Math.max(approxScale * 1e-6, 1e-9);
  }

  add(x: number, y: number, z: number): number {
    const q = this.quant;
    const key = `${Math.round(x / q)},${Math.round(y / q)},${Math.round(z / q)}`;
    let idx = this.map.get(key);
    if (idx === undefined) {
      idx = this.positions.length / 3;
      this.positions.push(x, y, z);
      this.map.set(key, idx);
    }
    return idx;
  }

  build(): Float32Array {
    return new Float32Array(this.positions);
  }
}

/* ------------------------------------------------------------------ */
/* Normal generation & bounds                                          */
/* ------------------------------------------------------------------ */

/**
 * Area-weighted smooth vertex normals. The un-normalized face cross product
 * has magnitude 2x the triangle area, so accumulating it directly applies
 * the face-average weighting for free.
 */
export function generateSmoothNormals(
  positions: Float32Array,
  indices: Uint32Array,
): Float32Array {
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    const abx = positions[b] - positions[a];
    const aby = positions[b + 1] - positions[a + 1];
    const abz = positions[b + 2] - positions[a + 2];
    const acx = positions[c] - positions[a];
    const acy = positions[c + 1] - positions[a + 1];
    const acz = positions[c + 2] - positions[a + 2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    normals[a] += nx; normals[a + 1] += ny; normals[a + 2] += nz;
    normals[b] += nx; normals[b + 1] += ny; normals[b + 2] += nz;
    normals[c] += nx; normals[c + 1] += ny; normals[c + 2] += nz;
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]);
    if (len > 1e-12) {
      normals[i] /= len;
      normals[i + 1] /= len;
      normals[i + 2] /= len;
    } else {
      normals[i + 1] = 1; // degenerate fan — point up rather than NaN
    }
  }
  return normals;
}

export function computeBounds(positions: Float32Array): ParsedMesh['bbox'] {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

function finalize(
  positions: Float32Array,
  indices: Uint32Array,
  normals: Float32Array | null,
  sourceFormat: ParsedMesh['sourceFormat'],
): ParsedMesh {
  const bbox = computeBounds(positions);
  const normalsGenerated = normals === null;
  return {
    positions,
    indices,
    normals: normals ?? generateSmoothNormals(positions, indices),
    bbox,
    center: [
      (bbox.min[0] + bbox.max[0]) / 2,
      (bbox.min[1] + bbox.max[1]) / 2,
      (bbox.min[2] + bbox.max[2]) / 2,
    ],
    triangleCount: indices.length / 3,
    vertexCount: positions.length / 3,
    normalsGenerated,
    sourceFormat,
  };
}

/* ------------------------------------------------------------------ */
/* Binary STL                                                          */
/* ------------------------------------------------------------------ */

export async function parseSTLBinary(
  buffer: ArrayBuffer,
  onProgress?: ProgressFn,
): Promise<ParsedMesh> {
  const view = new DataView(buffer);
  const triCount = Math.min(view.getUint32(80, true), Math.floor((buffer.byteLength - 84) / 50));

  // Estimate model scale from a sample of vertices for weld quantization.
  let scale = 0;
  const sample = Math.min(triCount, 500);
  for (let t = 0; t < sample; t++) {
    const off = 84 + t * 50 + 12;
    scale = Math.max(scale, Math.abs(view.getFloat32(off, true)), Math.abs(view.getFloat32(off + 4, true)), Math.abs(view.getFloat32(off + 8, true)));
  }
  const welder = new VertexWelder(scale || 1);
  const indices = new Uint32Array(triCount * 3);
  let healthyNormals = true;

  for (let t = 0; t < triCount; t++) {
    const base = 84 + t * 50;
    const nx = view.getFloat32(base, true);
    const ny = view.getFloat32(base + 4, true);
    const nz = view.getFloat32(base + 8, true);
    if (!Number.isFinite(nx) || nx * nx + ny * ny + nz * nz < 1e-12) healthyNormals = false;
    for (let v = 0; v < 3; v++) {
      const off = base + 12 + v * 12;
      indices[t * 3 + v] = welder.add(
        view.getFloat32(off, true),
        view.getFloat32(off + 4, true),
        view.getFloat32(off + 8, true),
      );
    }
    if (t % CHUNK_TRIANGLES === CHUNK_TRIANGLES - 1) {
      onProgress?.(t / triCount);
      await yieldToMain();
    }
  }
  onProgress?.(1);
  // STL face normals cannot be reused per-vertex after welding; always
  // regenerate smooth normals (face-area weighted). `healthyNormals` only
  // matters for reporting.
  void healthyNormals;
  return finalize(welder.build(), indices, null, 'stl-binary');
}

/* ------------------------------------------------------------------ */
/* ASCII STL                                                           */
/* ------------------------------------------------------------------ */

export async function parseSTLAscii(
  text: string,
  onProgress?: ProgressFn,
): Promise<ParsedMesh> {
  const lines = text.split('\n');
  const verts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const vi = line.indexOf('vertex');
    if (vi >= 0) {
      const parts = line.slice(vi + 6).trim().split(/\s+/);
      verts.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
    }
    if (i % CHUNK_LINES === CHUNK_LINES - 1) {
      onProgress?.((i / lines.length) * 0.7);
      await yieldToMain();
    }
  }
  const triCount = Math.floor(verts.length / 9);
  let scale = 0;
  for (let i = 0; i < Math.min(verts.length, 1500); i++) scale = Math.max(scale, Math.abs(verts[i]));
  const welder = new VertexWelder(scale || 1);
  const indices = new Uint32Array(triCount * 3);
  for (let t = 0; t < triCount; t++) {
    for (let v = 0; v < 3; v++) {
      const o = t * 9 + v * 3;
      indices[t * 3 + v] = welder.add(verts[o], verts[o + 1], verts[o + 2]);
    }
    if (t % CHUNK_TRIANGLES === CHUNK_TRIANGLES - 1) {
      onProgress?.(0.7 + (t / triCount) * 0.3);
      await yieldToMain();
    }
  }
  onProgress?.(1);
  return finalize(welder.build(), indices, null, 'stl-ascii');
}

/* ------------------------------------------------------------------ */
/* ASCII OBJ                                                           */
/* ------------------------------------------------------------------ */

/**
 * Parses positions, normals and faces. Polygons are fan-triangulated;
 * negative (relative) indices and v/vt/vn forms are handled. When every
 * face carries valid vn references the source normals are kept, otherwise
 * smooth normals are regenerated.
 */
export async function parseOBJ(
  text: string,
  onProgress?: ProgressFn,
): Promise<ParsedMesh> {
  const lines = text.split('\n');
  const srcPos: number[] = [];
  const srcNrm: number[] = [];

  // Output is re-indexed on (position, normal) pairs.
  const outPos: number[] = [];
  const outNrm: number[] = [];
  const outIdx: number[] = [];
  const pairMap = new Map<string, number>();
  let allFacesHaveNormals = true;

  const emit = (vRef: number, nRef: number): number => {
    const key = `${vRef}/${nRef}`;
    let idx = pairMap.get(key);
    if (idx === undefined) {
      idx = outPos.length / 3;
      const p = vRef * 3;
      outPos.push(srcPos[p], srcPos[p + 1], srcPos[p + 2]);
      if (nRef >= 0) {
        const n = nRef * 3;
        outNrm.push(srcNrm[n], srcNrm[n + 1], srcNrm[n + 2]);
      } else {
        outNrm.push(0, 0, 0);
      }
      pairMap.set(key, idx);
    }
    return idx;
  };

  const resolveIndex = (raw: number, count: number) =>
    raw > 0 ? raw - 1 : count + raw;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0 || line[0] === '#') {
      // skip
    } else if (line.startsWith('v ')) {
      const p = line.slice(2).trim().split(/\s+/);
      srcPos.push(parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]));
    } else if (line.startsWith('vn ')) {
      const p = line.slice(3).trim().split(/\s+/);
      srcNrm.push(parseFloat(p[0]), parseFloat(p[1]), parseFloat(p[2]));
    } else if (line.startsWith('f ')) {
      const refs = line.slice(2).trim().split(/\s+/);
      const vCount = srcPos.length / 3;
      const nCount = srcNrm.length / 3;
      const resolved: Array<[number, number]> = [];
      for (const ref of refs) {
        const segs = ref.split('/');
        const v = resolveIndex(parseInt(segs[0], 10), vCount);
        let n = -1;
        if (segs.length >= 3 && segs[2] !== '') {
          n = resolveIndex(parseInt(segs[2], 10), nCount);
          if (n < 0 || n >= nCount) n = -1;
        }
        if (n < 0) allFacesHaveNormals = false;
        if (v >= 0 && v < vCount) resolved.push([v, n]);
      }
      // Fan triangulation for quads / n-gons.
      for (let k = 1; k + 1 < resolved.length; k++) {
        outIdx.push(
          emit(resolved[0][0], resolved[0][1]),
          emit(resolved[k][0], resolved[k][1]),
          emit(resolved[k + 1][0], resolved[k + 1][1]),
        );
      }
    }
    if (i % CHUNK_LINES === CHUNK_LINES - 1) {
      onProgress?.(i / lines.length);
      await yieldToMain();
    }
  }
  onProgress?.(1);

  const positions = new Float32Array(outPos);
  const indices = new Uint32Array(outIdx);
  if (allFacesHaveNormals && srcNrm.length > 0) {
    // Validate the supplied normals; corrupted (zero / NaN) sets fall back.
    const normals = new Float32Array(outNrm);
    let healthy = true;
    for (let i = 0; i < normals.length; i += 3) {
      const l2 = normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2;
      if (!Number.isFinite(l2) || l2 < 1e-12) { healthy = false; break; }
      const inv = 1 / Math.sqrt(l2);
      normals[i] *= inv; normals[i + 1] *= inv; normals[i + 2] *= inv;
    }
    if (healthy) return finalize(positions, indices, normals, 'obj');
  }
  return finalize(positions, indices, null, 'obj');
}

/* ------------------------------------------------------------------ */
/* Top-level dispatch + tunnel normalization                           */
/* ------------------------------------------------------------------ */

export async function parseModelFile(
  file: File,
  onProgress?: ProgressFn,
): Promise<ParsedMesh> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.stl')) {
    const buffer = await file.arrayBuffer();
    return detectSTLFormat(buffer) === 'stl-binary'
      ? parseSTLBinary(buffer, onProgress)
      : parseSTLAscii(new TextDecoder().decode(buffer), onProgress);
  }
  if (name.endsWith('.obj')) {
    return parseOBJ(await file.text(), onProgress);
  }
  throw new Error(`Unsupported file format: ${file.name} (expected .stl or .obj)`);
}

/**
 * Builds a render-ready BufferGeometry from a parsed mesh, auto-centered and
 * scaled so the model's longest horizontal extent matches the tunnel target
 * length, resting on the ground plane. Models whose long axis is Z are
 * rotated to align with the X (flow) axis.
 */
export function normalizeToTunnel(parsed: ParsedMesh): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(parsed.positions.slice(), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(parsed.normals.slice(), 3));
  geo.setIndex(new THREE.BufferAttribute(parsed.indices.slice(), 1));

  const { bbox, center } = parsed;
  const ext = [
    bbox.max[0] - bbox.min[0],
    bbox.max[1] - bbox.min[1],
    bbox.max[2] - bbox.min[2],
  ];
  geo.translate(-center[0], -center[1], -center[2]);

  // Align the longest horizontal axis with the flow (X) axis.
  if (ext[2] > ext[0]) {
    geo.rotateY(Math.PI / 2);
    [ext[0], ext[2]] = [ext[2], ext[0]];
  }
  const length = Math.max(ext[0], 1e-6);
  const scale = MODEL_TARGET_LENGTH / length;
  geo.scale(scale, scale, scale);

  // Rest on the ground plane with a small ride-height clearance.
  geo.computeBoundingBox();
  const minY = geo.boundingBox!.min.y;
  geo.translate(0, -minY + 0.05, 0);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** Wraps an imported mesh as a single-part model for the workspace. */
export function parsedMeshToParts(parsed: ParsedMesh, name: string): CarPart[] {
  return [
    {
      id: 'imported-body',
      name,
      geometry: normalizeToTunnel(parsed),
      role: 'body',
      color: '#8fa3b8',
    },
  ];
}
