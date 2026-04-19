import { usePanelStore } from '../state/panelStore';

interface SecondaryHeaderProps {
  /** Override the default minimize action — lets the parent play a
   *  pre-minimize animation before dispatching to the store. */
  onMinimize?: () => void;
}

export function SecondaryHeader({ onMinimize }: SecondaryHeaderProps = {}) {
  const closeSecondary = usePanelStore((s) => s.closeSecondary);
  const minimizeSecondary = usePanelStore((s) => s.minimizeSecondary);
  const dockSecondary = usePanelStore((s) => s.dockSecondary);
  const undockSecondary = usePanelStore((s) => s.undockSecondary);
  const mode = usePanelStore((s) => s.secondary?.mode);

  const onGreen = mode === 'sticky-right' ? undockSecondary : dockSecondary;
  const onYellow = onMinimize ?? minimizeSecondary;

  return (
    <div className="rv-secondary-header">
      <button
        className="rv-secondary-tl rv-secondary-tl--red"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={closeSecondary}
        title="Close"
        aria-label="Close secondary chat"
      />
      <button
        className="rv-secondary-tl rv-secondary-tl--yellow"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onYellow}
        title="Minimize"
        aria-label="Minimize secondary chat"
      />
      <button
        className="rv-secondary-tl rv-secondary-tl--green"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onGreen}
        title={mode === 'sticky-right' ? 'Undock' : 'Dock right'}
        aria-label={mode === 'sticky-right' ? 'Undock secondary chat' : 'Dock secondary chat to the right'}
      />
      {/* Grab zone — only this div initiates a drag. Buttons live outside it. */}
      <div className="rv-secondary-drag-zone" aria-hidden="true" />
    </div>
  );
}
