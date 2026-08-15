/**
 * @module useFloatingWindow
 * @role Drag + resize mechanics for floating windows. Tracks live geometry
 *       locally during a gesture and commits ONCE on mouse-up, so callers
 *       can persist in onCommit without per-mousemove write amplification.
 *
 * Consumers: SecondaryChat (chat popup), EmailComposeWindow (mail compose).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface FloatGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloatBounds {
  width: number;
  height: number;
}

interface UseFloatingWindowOptions {
  /** Committed geometry (from the caller's store). */
  geometry: FloatGeometry;
  /** Fires once per gesture, on mouse-up. Persist here. */
  onCommit: (geometry: FloatGeometry) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Container dimensions used to clamp dragging. Defaults to the viewport. */
  getBounds?: () => FloatBounds;
}

// Keep at least this much of the window reachable so it can't be dragged
// fully out of bounds.
const EDGE_KEEPALIVE_X = 80;
const EDGE_KEEPALIVE_Y = 40;

function clamp(value: number, min: number, max?: number): number {
  const upper = max === undefined ? value : Math.min(max, value);
  return Math.max(min, upper);
}

export function useFloatingWindow({
  geometry,
  onCommit,
  minWidth = 200,
  minHeight = 150,
  maxWidth,
  maxHeight,
  getBounds,
}: UseFloatingWindowOptions) {
  const [live, setLive] = useState<FloatGeometry>(geometry);

  const gestureRef = useRef<{ kind: 'drag' | 'resize'; startX: number; startY: number; orig: FloatGeometry } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const liveRef = useRef(live);
  liveRef.current = live;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const getBoundsRef = useRef(getBounds);
  getBoundsRef.current = getBounds;

  // Adopt externally committed geometry whenever no gesture is active.
  useEffect(() => {
    if (!gestureRef.current) {
      setLive(geometry);
    }
  }, [geometry.x, geometry.y, geometry.width, geometry.height]);

  // Remove document listeners if the component unmounts mid-gesture.
  useEffect(() => () => cleanupRef.current?.(), []);

  const beginGesture = useCallback((kind: 'drag' | 'resize', e: React.MouseEvent) => {
    e.preventDefault();
    if (kind === 'resize') e.stopPropagation();
    gestureRef.current = { kind, startX: e.clientX, startY: e.clientY, orig: liveRef.current };
    document.body.style.userSelect = 'none';

    const handleMove = (ev: MouseEvent) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const dx = ev.clientX - gesture.startX;
      const dy = ev.clientY - gesture.startY;

      if (gesture.kind === 'drag') {
        const bounds = getBoundsRef.current?.()
          ?? { width: window.innerWidth, height: window.innerHeight };
        const x = clamp(
          gesture.orig.x + dx,
          EDGE_KEEPALIVE_X - gesture.orig.width,
          Math.max(0, bounds.width - EDGE_KEEPALIVE_X)
        );
        const y = clamp(
          gesture.orig.y + dy,
          0,
          Math.max(0, bounds.height - EDGE_KEEPALIVE_Y)
        );
        setLive({ ...gesture.orig, x, y });
      } else {
        setLive({
          ...gesture.orig,
          width: clamp(gesture.orig.width + dx, minWidth, maxWidth),
          height: clamp(gesture.orig.height + dy, minHeight, maxHeight),
        });
      }
    };

    const handleUp = () => {
      cleanupRef.current?.();
      if (gestureRef.current) {
        gestureRef.current = null;
        onCommitRef.current(liveRef.current);
      }
    };

    cleanupRef.current = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = '';
      cleanupRef.current = null;
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [minWidth, minHeight, maxWidth, maxHeight]);

  const startDrag = useCallback((e: React.MouseEvent) => beginGesture('drag', e), [beginGesture]);
  const startResize = useCallback((e: React.MouseEvent) => beginGesture('resize', e), [beginGesture]);

  return { live, startDrag, startResize };
}
