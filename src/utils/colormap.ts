/**
 * Professional 4-stop diagnostic gradient: cool blue -> green -> yellow ->
 * hot red. Implemented once for the CPU (line vertex colors, mesh pressure
 * overlay, UI legend) and once as a GLSL chunk for the particle shader so
 * every visualization maps scalars identically.
 */

export const COLORMAP_STOPS: Array<[number, [number, number, number]]> = [
  [0.0, [0.09, 0.28, 1.0]],
  [0.35, [0.1, 0.84, 0.45]],
  [0.65, [1.0, 0.88, 0.16]],
  [1.0, [1.0, 0.16, 0.09]],
];

/** Samples the gradient at t in [0,1], writing rgb into out[offset..+2]. */
export function sampleColormap(
  t: number,
  out: Float32Array | number[],
  offset = 0,
): void {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  for (let i = 1; i < COLORMAP_STOPS.length; i++) {
    const [t1, c1] = COLORMAP_STOPS[i];
    if (x <= t1 || i === COLORMAP_STOPS.length - 1) {
      const [t0, c0] = COLORMAP_STOPS[i - 1];
      const f = (x - t0) / (t1 - t0);
      const g = f < 0 ? 0 : f > 1 ? 1 : f;
      out[offset] = c0[0] + (c1[0] - c0[0]) * g;
      out[offset + 1] = c0[1] + (c1[1] - c0[1]) * g;
      out[offset + 2] = c0[2] + (c1[2] - c0[2]) * g;
      return;
    }
  }
}

/** CSS linear-gradient string for the UI legend. */
export function colormapCss(direction = 'to right'): string {
  const stops = COLORMAP_STOPS.map(
    ([t, [r, g, b]]) =>
      `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${Math.round(t * 100)}%`,
  ).join(', ');
  return `linear-gradient(${direction}, ${stops})`;
}

/** GLSL implementation of the same gradient. */
export const COLORMAP_GLSL = /* glsl */ `
vec3 aeroColormap(float t) {
  t = clamp(t, 0.0, 1.0);
  vec3 c0 = vec3(0.09, 0.28, 1.00);
  vec3 c1 = vec3(0.10, 0.84, 0.45);
  vec3 c2 = vec3(1.00, 0.88, 0.16);
  vec3 c3 = vec3(1.00, 0.16, 0.09);
  vec3 col = mix(c0, c1, smoothstep(0.00, 0.35, t));
  col = mix(col, c2, smoothstep(0.35, 0.65, t));
  col = mix(col, c3, smoothstep(0.65, 1.00, t));
  return col;
}
`;
