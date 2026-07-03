import { useEffect, useMemo, useState } from 'react';
import './ScreenshotFlashOverlay.css';

interface ScreenshotFlashOverlayProps {
  imageDataUrl: string | null;
  onComplete?: () => void;
}

const FULL_PAUSE_DURATION = 300;
const SHRINK_DURATION = 500;
const PAUSE_DURATION = 300;
const FADE_DURATION = 200;

type Phase = 'idle' | 'full' | 'thumbnail' | 'fade';

export function ScreenshotFlashOverlay({ imageDataUrl, onComplete }: ScreenshotFlashOverlayProps) {
  const [phase, setPhase] = useState<Phase>('idle');

  const scale = useMemo(() => {
    if (!imageDataUrl) return 1;
    const desiredWidth = 240;
    return Math.max(1, window.innerWidth / desiredWidth);
  }, [imageDataUrl]);

  useEffect(() => {
    if (!imageDataUrl) {
      setPhase('idle');
      return;
    }

    setPhase('full');

    const shrinkTimer = window.setTimeout(() => {
      setPhase('thumbnail');
    }, FULL_PAUSE_DURATION);

    const fadeTimer = window.setTimeout(() => {
      setPhase('fade');
    }, FULL_PAUSE_DURATION + SHRINK_DURATION + PAUSE_DURATION);

    const cleanupTimer = window.setTimeout(() => {
      setPhase('idle');
      onComplete?.();
    }, FULL_PAUSE_DURATION + SHRINK_DURATION + PAUSE_DURATION + FADE_DURATION);

    return () => {
      window.clearTimeout(shrinkTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [imageDataUrl, onComplete]);

  if (phase === 'idle' || !imageDataUrl) {
    return null;
  }

  return (
    <div
      className={`rv-screenshot-flash-overlay rv-screenshot-flash-overlay--${phase}`}
      style={{ '--flash-scale': scale } as React.CSSProperties}
    >
      <img
        src={imageDataUrl}
        alt="Screenshot captured"
        className="rv-screenshot-flash-image"
      />
    </div>
  );
}
