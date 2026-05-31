import './HourglassFlow.css';

interface HourglassFlowProps {
  label?: string;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function HourglassFlow({
  label,
  ariaLabel = label || 'Loading',
  size = 'md',
  className = '',
}: HourglassFlowProps) {
  const classes = ['rv-hourglass-flow', `rv-hourglass-flow--${size}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status" aria-live="polite" aria-label={ariaLabel}>
      <span className="rv-hourglass-flow-icon" aria-hidden="true">
        <span className="material-symbols-outlined rv-hourglass-glyph rv-hourglass-bottom">
          hourglass_bottom
        </span>
        <span className="rv-hourglass-top-layer">
          <span className="rv-hourglass-top-backing" />
          <span className="material-symbols-outlined rv-hourglass-glyph rv-hourglass-top">
            hourglass_top
          </span>
        </span>
        <span className="rv-hourglass-stream" />
      </span>
      {label && <span className="rv-hourglass-flow-label">{label}</span>}
    </div>
  );
}
