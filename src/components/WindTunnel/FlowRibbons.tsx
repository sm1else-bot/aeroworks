import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useAeroStore } from '../../store';
import { KMH_TO_MS } from '../../types';
import { useStreamlineGeometry } from './streamlineTracer';

/** Dash pattern in world meters along each streamline. */
const DASH_SIZE = 0.42;
const GAP_SIZE = 0.55;

// ShaderMaterial without vertexColors does not auto-declare `color`, so the
// geometry's color + aDist attributes are declared explicitly here.
const VERTEX = /* glsl */ `
attribute vec3 color;
attribute float aDist;
varying vec3 vColor;
varying float vDist;
void main() {
  vColor = color;
  vDist = aDist;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
uniform float uDashOffset;
uniform float uDashSize;
uniform float uGapSize;
uniform float uOpacity;
varying vec3 vColor;
varying float vDist;
void main() {
  float period = uDashSize + uGapSize;
  float m = mod(vDist - uDashOffset, period);
  if (m > uDashSize) discard;
  // Comet profile: sharp bright head, trailing fade.
  float t = m / uDashSize;
  float alpha = smoothstep(0.0, 0.12, t) * (1.0 - t * 0.75);
  float head = smoothstep(0.78, 0.98, t) * 0.9;
  vec3 col = vColor * (1.25 + head);
  gl_FragColor = vec4(col, alpha * uOpacity);
}
`;

/**
 * FLOW mode: the exact streamline paths from Ribbons mode, rendered as
 * neon dashes marching downstream. The dash offset advances at the
 * freestream speed, so dragging the Air Velocity slider physically speeds
 * up or slows down the pulses (and pausing freezes them).
 */
export function FlowRibbons() {
  const geometry = useStreamlineGeometry();
  const offsetRef = useRef(0);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: {
          uDashOffset: { value: 0 },
          uDashSize: { value: DASH_SIZE },
          uGapSize: { value: GAP_SIZE },
          uOpacity: { value: 0.95 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [],
  );

  useEffect(() => () => material.dispose(), [material]);

  useFrame((_, dt) => {
    const s = useAeroStore.getState();
    if (!s.paused) {
      // March at the actual freestream speed (m/s) along the arc-length
      // coordinate; modulo keeps the float small over long sessions.
      const period = DASH_SIZE + GAP_SIZE;
      offsetRef.current =
        (offsetRef.current + s.speedKmh * KMH_TO_MS * Math.min(dt, 1 / 30)) % (period * 1e4);
    }
    material.uniforms.uDashOffset.value = offsetRef.current;
  });

  return <lineSegments geometry={geometry} material={material} frustumCulled={false} />;
}
