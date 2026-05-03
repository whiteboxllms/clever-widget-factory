import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ActionPoint } from '@/types/energeia';
import { computeEnergyProportions } from './EnergyBar';

interface OikonomiaBackgroundProps {
  points: ActionPoint[];
}

// Color anchors — blended by energy proportions each frame
// High Oikonomia → cold deep indigo space
// High Dynamis   → warm golden ambient
// High Techne    → violet twilight
const OIKONOMIA_BG  = new THREE.Color(0x020408);
const DYNAMIS_BG    = new THREE.Color(0x0a0805);
const TECHNE_BG     = new THREE.Color(0x060208);

const OIKONOMIA_AMB = new THREE.Color(0x0a0f1a);
const DYNAMIS_AMB   = new THREE.Color(0x1a1205);
const TECHNE_AMB    = new THREE.Color(0x0f0518);

export function OikonomiaBackground({ points }: OikonomiaBackgroundProps) {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);

  const proportions = computeEnergyProportions(points);

  const targetBg = new THREE.Color(
    OIKONOMIA_BG.r * proportions.oikonomia + DYNAMIS_BG.r * proportions.dynamis + TECHNE_BG.r * proportions.techne,
    OIKONOMIA_BG.g * proportions.oikonomia + DYNAMIS_BG.g * proportions.dynamis + TECHNE_BG.g * proportions.techne,
    OIKONOMIA_BG.b * proportions.oikonomia + DYNAMIS_BG.b * proportions.dynamis + TECHNE_BG.b * proportions.techne,
  );
  // Floor to avoid pure black
  targetBg.r = Math.max(targetBg.r, 0.005);
  targetBg.g = Math.max(targetBg.g, 0.005);
  targetBg.b = Math.max(targetBg.b, 0.012);

  const targetAmb = new THREE.Color(
    OIKONOMIA_AMB.r * proportions.oikonomia + DYNAMIS_AMB.r * proportions.dynamis + TECHNE_AMB.r * proportions.techne,
    OIKONOMIA_AMB.g * proportions.oikonomia + DYNAMIS_AMB.g * proportions.dynamis + TECHNE_AMB.g * proportions.techne,
    OIKONOMIA_AMB.b * proportions.oikonomia + DYNAMIS_AMB.b * proportions.dynamis + TECHNE_AMB.b * proportions.techne,
  );

  useFrame((_, delta) => {
    const speed = delta * 0.6; // slow dreamy transition

    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(targetBg, speed);
    } else {
      scene.background = targetBg.clone();
    }

    if (ambientRef.current) {
      ambientRef.current.color.lerp(targetAmb, speed);
    }
  });

  return <ambientLight ref={ambientRef} intensity={1.0} />;
}

export default OikonomiaBackground;
