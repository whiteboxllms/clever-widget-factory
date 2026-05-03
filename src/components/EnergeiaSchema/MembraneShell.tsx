import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import type { ClusterInfo } from '@/types/energeia';

interface MembraneShellProps {
  clusters: ClusterInfo[];
}

const simplex = new SimplexNoise();

const NOISE_AMPLITUDE = 1.8;
const NOISE_SCALE = 0.18;
const NOISE_SPEED = 0.18;
const PADDING = 1.8;
const SUBDIVISIONS = 3;

// Fresnel shader — edges glow bright, center stays transparent
const fresnelVertexShader = /* glsl */`
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vViewDir = normalize(cameraPosition - worldPos.xyz);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fresnelFragmentShader = /* glsl */`
  uniform vec3 uColor;
  uniform float uFresnelPower;
  uniform float uOpacityCenter;
  uniform float uOpacityEdge;
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    float fresnel = pow(1.0 - abs(dot(vNormal, vViewDir)), uFresnelPower);
    float alpha = mix(uOpacityCenter, uOpacityEdge, fresnel);
    vec3 color = mix(uColor * 0.3, uColor, fresnel);
    gl_FragColor = vec4(color, alpha);
  }
`;

function subdivide(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const newPositions: number[] = [];

  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, i);
    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
    const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
    const ab = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const bc = new THREE.Vector3().addVectors(b, c).multiplyScalar(0.5);
    const ca = new THREE.Vector3().addVectors(c, a).multiplyScalar(0.5);

    for (const tri of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]] as THREE.Vector3[][]) {
      for (const v of tri) newPositions.push(v.x, v.y, v.z);
    }
  }

  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  return result;
}

export function MembraneShell({ clusters }: MembraneShellProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const internalClusters = clusters.filter(c => c.boundary_type === 'internal');

  const clusterKey = internalClusters
    .map(c => `${c.id}:${c.centroid_x.toFixed(2)},${c.centroid_y.toFixed(2)},${c.centroid_z.toFixed(2)}`)
    .join('|');

  const { baseGeo, animGeo, center, fresnelMaterial } = useMemo(() => {
    const empty = {
      baseGeo: null as THREE.BufferGeometry | null,
      animGeo: null as THREE.BufferGeometry | null,
      center: new THREE.Vector3(),
      fresnelMaterial: null as THREE.ShaderMaterial | null,
    };

    if (internalClusters.length === 0) return empty;

    let cx = 0, cy = 0, cz = 0;
    for (const c of internalClusters) { cx += c.centroid_x; cy += c.centroid_y; cz += c.centroid_z; }
    cx /= internalClusters.length;
    cy /= internalClusters.length;
    cz /= internalClusters.length;
    const center = new THREE.Vector3(cx, cy, cz);

    const points = internalClusters.map(c => {
      const d = new THREE.Vector3(c.centroid_x - cx, c.centroid_y - cy, c.centroid_z - cz);
      const len = d.length();
      if (len < 0.01) d.set(1, 0, 0);
      return new THREE.Vector3(cx, cy, cz).addScaledVector(d.normalize(), Math.max(len, 3) * PADDING);
    });

    let geo: THREE.BufferGeometry;
    if (internalClusters.length < 4) {
      const radius = Math.max(
        ...internalClusters.map(c => {
          const dx = c.centroid_x - cx, dy = c.centroid_y - cy, dz = c.centroid_z - cz;
          return Math.sqrt(dx*dx + dy*dy + dz*dz);
        }),
        4
      ) * PADDING;
      geo = new THREE.SphereGeometry(radius, 32, 32);
      geo.translate(cx, cy, cz);
    } else {
      try {
        geo = new ConvexGeometry(points);
      } catch {
        const fallback = new THREE.SphereGeometry(8, 32, 32);
        fallback.translate(cx, cy, cz);
        geo = fallback;
      }
    }

    let subdivided = geo;
    for (let i = 0; i < SUBDIVISIONS; i++) {
      subdivided = subdivide(subdivided);
    }
    subdivided.computeVertexNormals();

    const fresnelMaterial = new THREE.ShaderMaterial({
      vertexShader: fresnelVertexShader,
      fragmentShader: fresnelFragmentShader,
      uniforms: {
        uColor:         { value: new THREE.Color(0x00e5ff) },
        uFresnelPower:  { value: 2.5 },
        uOpacityCenter: { value: 0.02 },
        uOpacityEdge:   { value: 0.55 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    return { baseGeo: subdivided, animGeo: subdivided.clone(), center, fresnelMaterial };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterKey]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !baseGeo || !animGeo) return;

    timeRef.current += delta * NOISE_SPEED;
    const t = timeRef.current;

    const base = baseGeo.attributes.position;
    const pos = animGeo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < base.count; i++) {
      const bx = base.getX(i);
      const by = base.getY(i);
      const bz = base.getZ(i);

      const dx = bx - center.x;
      const dy = by - center.y;
      const dz = bz - center.z;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;

      const noise = simplex.noise4d(
        bx * NOISE_SCALE,
        by * NOISE_SCALE,
        bz * NOISE_SCALE,
        t
      );
      const disp = noise * NOISE_AMPLITUDE;

      pos.setXYZ(
        i,
        bx + (dx / len) * disp,
        by + (dy / len) * disp,
        bz + (dz / len) * disp
      );
    }

    pos.needsUpdate = true;
    animGeo.computeVertexNormals();
  });

  if (!animGeo || !fresnelMaterial || internalClusters.length === 0) return null;

  return (
    <mesh ref={meshRef} geometry={animGeo} material={fresnelMaterial} renderOrder={-1} />
  );
}

export default MembraneShell;
