import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useAeroStore } from '../../store';
import { KMH_TO_MS } from '../../types';
import { COLORMAP_GLSL } from '../../utils/colormap';
import { fieldManager } from '../../utils/fieldManager';
import type { ParticleSim } from './particleSim';

const VERTEX = /* glsl */ `
attribute float aScalar;
attribute float aFade;
uniform float uSize;
varying float vScalar;
varying float vFade;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = clamp(uSize * (160.0 / -mv.z), 1.0, 16.0);
  vScalar = aScalar;
  vFade = aFade;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
${COLORMAP_GLSL}
uniform float uOpacity;
varying float vScalar;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float alpha = smoothstep(0.5, 0.1, d) * vFade * uOpacity;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(aeroColormap(vScalar), alpha);
}
`;

interface Props {
  sim: ParticleSim;
  /** Point size factor (screen-space, distance attenuated). */
  size: number;
  opacity: number;
  /** Multiplier on the global particle lifetime. */
  lifetimeScale?: number;
  /** When set, overrides the store particle count for this cloud. */
  fixedCount?: number;
}

/**
 * GPU point cloud bound directly to a ParticleSim's TypedArrays. One draw
 * call regardless of particle count; per-particle color is resolved in the
 * fragment shader from the scalar attribute via the shared colormap.
 */
export function ParticleCloud({ sim, size, opacity, lifetimeScale = 1, fixedCount }: Props) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  const { geometry, material } = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(sim.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aScalar', new THREE.BufferAttribute(sim.scalar, 1).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('aFade', new THREE.BufferAttribute(sim.fade, 1).setUsage(THREE.DynamicDrawUsage));
    // Particles roam the whole tunnel; skip per-frame bounds work.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(2, 2, 0), 60);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uSize: { value: size },
        uOpacity: { value: opacity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry, material };
  }, [sim]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame((state, dt) => {
    const s = useAeroStore.getState();
    material.uniforms.uSize.value = size;
    material.uniforms.uOpacity.value = opacity;
    sim.setCount(fixedCount ?? s.particleCount);
    geometry.setDrawRange(0, sim.count);
    if (s.paused) return;

    sim.step(dt, {
      field: fieldManager.field,
      time: state.clock.elapsedTime,
      freestream: s.speedKmh * KMH_TO_MS,
      turbulence: s.turbulence,
      epsilon: s.slipEpsilon,
      colorMode: s.colorMode,
      lifetime: s.particleLifetime * lifetimeScale,
    });
    (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.aScalar as THREE.BufferAttribute).needsUpdate = true;
    (geometry.attributes.aFade as THREE.BufferAttribute).needsUpdate = true;
  });

  return <points ref={geoRef as never} geometry={geometry} material={material} frustumCulled={false} />;
}
