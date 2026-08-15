/**
 * @module EmailComposeWindow
 * @role Single compose window: draggable/resizable via useFloatingWindow,
 *       upper-right controls (minimize to tab / expand to fill panel / close).
 *       Stoplight controls are reserved for the chat popup — not used here.
 */

import { useCallback } from 'react';
import { useFloatingWindow, type FloatBounds } from '../../hooks/useFloatingWindow';
import { useEmailComposeStore, type ComposeWindowState } from './composeStore';

interface EmailComposeWindowProps {
  win: ComposeWindowState;
  getBounds: () => FloatBounds;
}

export function EmailComposeWindow({ win, getBounds }: EmailComposeWindowProps) {
  const closeCompose = useEmailComposeStore((s) => s.closeCompose);
  const minimizeCompose = useEmailComposeStore((s) => s.minimizeCompose);
  const toggleExpand = useEmailComposeStore((s) => s.toggleExpand);
  const setGeometry = useEmailComposeStore((s) => s.setGeometry);
  const focusCompose = useEmailComposeStore((s) => s.focusCompose);
  const setField = useEmailComposeStore((s) => s.setField);

  const expanded = win.mode === 'expanded';

  const { live, startDrag, startResize } = useFloatingWindow({
    geometry: win.geometry,
    onCommit: (g) => setGeometry(win.id, g),
    minWidth: 320,
    minHeight: 280,
    maxWidth: 900,
    maxHeight: 800,
    getBounds,
  });

  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (expanded) return;
    if ((e.target as HTMLElement).closest('button')) return;
    startDrag(e);
  }, [expanded, startDrag]);

  const className = [
    'rv-email-compose-window',
    expanded ? 'rv-email-compose-window--expanded' : '',
  ].filter(Boolean).join(' ');

  const style = expanded
    ? { zIndex: win.z }
    : {
        left: `${live.x}px`,
        top: `${live.y}px`,
        width: `${live.width}px`,
        height: `${live.height}px`,
        zIndex: win.z,
        // Hide until the layer resolves the -1 placement sentinel.
        visibility: win.geometry.x < 0 ? 'hidden' as const : undefined,
      };

  return (
    <section
      className={className}
      style={style}
      aria-label="Compose message"
      onMouseDown={() => focusCompose(win.id)}
    >
      <header className="rv-email-compose-header" onMouseDown={handleHeaderMouseDown}>
        <span className="rv-email-compose-title">{win.subject || 'New Message'}</span>
        <div className="rv-email-compose-controls">
          <button
            type="button"
            className="rv-email-compose-ctrl-btn"
            title="Minimize"
            aria-label="Minimize"
            onClick={() => minimizeCompose(win.id)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">check_indeterminate_small</span>
          </button>
          <button
            type="button"
            className="rv-email-compose-ctrl-btn"
            title={expanded ? 'Restore size' : 'Expand'}
            aria-label={expanded ? 'Restore size' : 'Expand'}
            onClick={() => toggleExpand(win.id)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {expanded ? 'collapse_content' : 'expand_content'}
            </span>
          </button>
          <button
            type="button"
            className="rv-email-compose-ctrl-btn"
            title="Close"
            aria-label="Close"
            onClick={() => closeCompose(win.id)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
      </header>
      <input
        className="rv-email-compose-field"
        type="text"
        placeholder="To"
        aria-label="To"
        value={win.to}
        onChange={(e) => setField(win.id, 'to', e.target.value)}
      />
      <input
        className="rv-email-compose-field"
        type="text"
        placeholder="Subject"
        aria-label="Subject"
        value={win.subject}
        onChange={(e) => setField(win.id, 'subject', e.target.value)}
      />
      <textarea
        className="rv-email-compose-body"
        aria-label="Message body"
        value={win.body}
        onChange={(e) => setField(win.id, 'body', e.target.value)}
      />
      <footer className="rv-email-compose-footer">
        <button
          type="button"
          className="rv-email-compose-send-btn"
          onClick={() => closeCompose(win.id)}
        >
          Send
        </button>
      </footer>
      {!expanded ? (
        <div
          className="rv-email-compose-resize-handle"
          onMouseDown={startResize}
          aria-hidden="true"
        />
      ) : null}
    </section>
  );
}
