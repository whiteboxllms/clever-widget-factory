import { useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';

/**
 * SceneControls — auto-rotation + orbital controls for the Energeia Map.
 *
 * Behaviour:
 * - Auto-rotates by default (isAutoRotating = true).
 * - On OrbitControls `onStart` (pointer down / drag start): pause auto-rotation
 *   and clear any pending resume timer.
 * - On OrbitControls `onEnd` (pointer up / drag end): start a 3-second idle
 *   timer; after 3 seconds of no interaction, resume auto-rotation.
 *
 * Requirements: 6.4, 6.5, 6.6
 */
export function SceneControls() {
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleStart = () => {
    // User started interacting — pause auto-rotation and cancel any pending resume.
    setIsAutoRotating(false);
    clearTimer();
  };

  const handleEnd = () => {
    // User stopped interacting — resume auto-rotation after 3 seconds of idle.
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsAutoRotating(true);
    }, 3000);
  };

  return (
    <OrbitControls
      enableDamping
      dampingFactor={0.05}
      autoRotate={isAutoRotating}
      autoRotateSpeed={0.5}
      onStart={handleStart}
      onEnd={handleEnd}
    />
  );
}

export default SceneControls;
