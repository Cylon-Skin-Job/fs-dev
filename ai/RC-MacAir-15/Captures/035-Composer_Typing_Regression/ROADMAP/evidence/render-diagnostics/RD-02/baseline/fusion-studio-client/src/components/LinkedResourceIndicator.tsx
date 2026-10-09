import './LinkedResourceIndicator.css';

interface LinkedResourceIndicatorProps {
  symlinkTarget?: string;
  className?: string;
}

export function linkedResourceTitle(symlinkTarget: string): string {
  return `This resource is linked. Source: ${symlinkTarget}. Edits here update the same underlying file.`;
}

export function LinkedResourceIndicator({
  symlinkTarget,
  className = 'rv-linked-resource-indicator',
}: LinkedResourceIndicatorProps) {
  if (!symlinkTarget) return null;

  return (
    <span
      className={`rv-linked-resource-indicator ${className}`.trim()}
      title={linkedResourceTitle(symlinkTarget)}
      aria-label={linkedResourceTitle(symlinkTarget)}
    >
      <span className="material-symbols-outlined" aria-hidden="true">folder_match</span>
    </span>
  );
}
