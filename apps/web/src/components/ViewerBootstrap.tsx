import { type ReactElement, useEffect, useRef } from 'react';

import { createViewer } from '@3ddet/three';

/**
 * Mounts the bootstrap viewer from @3ddet/three. Verifies that Three.js loads, the WebGL
 * renderer initialises, and the scene and camera render. It is not the digital twin.
 */
export function ViewerBootstrap(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return undefined;

    const viewer = createViewer(canvas);
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) {
        viewer.resize(entry.contentRect.width, entry.contentRect.height);
      }
    });
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      viewer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-label="Rendering pipeline check" />;
}
