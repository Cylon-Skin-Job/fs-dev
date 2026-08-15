/**
 * @module EmailComposeLayer
 * @role Overlay inside the email content panel hosting all compose windows
 *       plus the bottom tab strip for minimized ones. Resolves the -1
 *       placement sentinel by cascading new windows from the lower-right.
 */

import { useCallback, useLayoutEffect, useRef } from 'react';
import { useEmailComposeStore } from './composeStore';
import { EmailComposeWindow } from './EmailComposeWindow';
import './EmailCompose.css';

export function EmailComposeLayer() {
  const windows = useEmailComposeStore((s) => s.windows);
  const setGeometry = useEmailComposeStore((s) => s.setGeometry);
  const restoreCompose = useEmailComposeStore((s) => s.restoreCompose);
  const closeCompose = useEmailComposeStore((s) => s.closeCompose);
  const layerRef = useRef<HTMLDivElement | null>(null);

  // Place newly opened windows: cascade from the lower-right corner.
  useLayoutEffect(() => {
    const rect = layerRef.current?.getBoundingClientRect();
    if (!rect) return;
    windows.forEach((win, index) => {
      if (win.geometry.x >= 0) return;
      const offset = (index % 4) * 32;
      setGeometry(win.id, {
        ...win.geometry,
        x: Math.max(8, rect.width - win.geometry.width - 16 - offset),
        y: Math.max(8, rect.height - win.geometry.height - 8 - offset),
      });
    });
  }, [windows, setGeometry]);

  const getBounds = useCallback(() => {
    const rect = layerRef.current?.getBoundingClientRect();
    return rect
      ? { width: rect.width, height: rect.height }
      : { width: window.innerWidth, height: window.innerHeight };
  }, []);

  const minimized = windows.filter((win) => win.mode === 'minimized');

  return (
    <div className="rv-email-compose-layer" ref={layerRef}>
      {windows
        .filter((win) => win.mode !== 'minimized')
        .map((win) => (
          <EmailComposeWindow key={win.id} win={win} getBounds={getBounds} />
        ))}
      {minimized.length > 0 ? (
        <div className="rv-email-compose-tabs">
          {minimized.map((win) => (
            <div className="rv-email-compose-tab" key={win.id}>
              <button
                type="button"
                className="rv-email-compose-tab-title"
                title={win.subject || 'New Message'}
                onClick={() => restoreCompose(win.id)}
              >
                {win.subject || 'New Message'}
              </button>
              <button
                type="button"
                className="rv-email-compose-ctrl-btn"
                title="Restore"
                aria-label="Restore"
                onClick={() => restoreCompose(win.id)}
              >
                <span className="material-symbols-outlined" aria-hidden="true">expand_content</span>
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
          ))}
        </div>
      ) : null}
    </div>
  );
}
