import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraCaptureProps {
  onCamera: (camera: THREE.Camera) => void;
}

/**
 * Invisible R3F component that captures the camera and passes it to a DOM parent.
 * Renders nothing — just syncs the camera ref on every frame.
 */
export function CameraCapture({ onCamera }: CameraCaptureProps) {
  const { camera } = useThree();

  useEffect(() => {
    onCamera(camera);
  });

  return null;
}
