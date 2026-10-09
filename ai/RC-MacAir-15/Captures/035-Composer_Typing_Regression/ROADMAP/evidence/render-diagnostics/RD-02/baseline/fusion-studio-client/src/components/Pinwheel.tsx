/**
 * Pinwheel — composable loading spinner.
 *
 * Renders a 12-spoke pinwheel with a rotating gradient. Every spoke keeps
 * the same base color; the perceived motion comes from shifting lighter and
 * darker tints from spoke to spoke.
 */

import { useEffect, useMemo, useRef } from 'react';
import './Pinwheel.css';

interface PinwheelProps {
  /** Any CSS length. Defaults to 25rem (400px at a 16px root font). */
  size?: string;
  /** Any CSS color. */
  color?: string;
  /** Seconds per full rotation. Defaults to 0.6. */
  spinDuration?: number;
  className?: string;
}

const SPOKE_COUNT = 12;

// Darkest at index 0, lightest at index count - 1, then wraps back to darkest.
const DEFAULT_OPACITIES = [1.00, 0.94, 0.89, 0.83, 0.77, 0.72, 0.66, 0.52, 0.40, 0.30, 0.22, 0.16];

export function Pinwheel({
  size = '25rem',
  color = '#2d9bf5',
  spinDuration = 0.6,
  className = '',
}: PinwheelProps) {
  const stepMs = useMemo(() => (spinDuration * 1000) / SPOKE_COUNT, [spinDuration]);
  const spokesRef = useRef<(HTMLDivElement | null)[]>([]);
  const opacitiesRef = useRef([...DEFAULT_OPACITIES]);

  useEffect(() => {
    const spokes = spokesRef.current;
    const opacities = opacitiesRef.current;

    function apply() {
      for (let i = 0; i < SPOKE_COUNT; i++) {
        const spoke = spokes[i];
        if (spoke) {
          spoke.style.setProperty('--spoke-opacity', String(opacities[i]));
        }
      }
    }

    function shiftClockwise() {
      // Move each tint to the next clockwise spoke. Because the spokes are
      // arranged clockwise by index, this means each spoke inherits the value
      // from its counter-clockwise neighbor.
      const last = opacities[SPOKE_COUNT - 1];
      for (let i = SPOKE_COUNT - 1; i > 0; i--) {
        opacities[i] = opacities[i - 1];
      }
      opacities[0] = last;
      apply();
    }

    apply();
    const id = setInterval(shiftClockwise, stepMs);
    return () => clearInterval(id);
  }, [stepMs]);

  const containerStyle = {
    '--pinwheel-size': size,
    '--spoke-color': color,
  } as React.CSSProperties;

  return (
    <div className={`pinwheel ${className}`.trim()} style={containerStyle}>
      {Array.from({ length: SPOKE_COUNT }, (_, i) => (
        <div
          key={i}
          className="spoke"
          style={{ '--i': i } as React.CSSProperties}
          ref={(el) => { spokesRef.current[i] = el; }}
        />
      ))}
    </div>
  );
}
