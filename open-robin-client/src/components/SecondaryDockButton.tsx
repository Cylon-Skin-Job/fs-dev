/**
 * @module SecondaryDockButton
 * @role Minimized-state dock button for SecondaryChat (SECONDARY_CHAT_SPEC §7b).
 *
 * Renders only when secondary.mode === 'minimized'. Click restores the popup
 * to whichever mode it was in before minimize (floating or sticky-right).
 */

import { usePanelStore } from '../state/panelStore';

export function SecondaryDockButton() {
  const secondary = usePanelStore((s) => s.secondary);
  const restoreSecondary = usePanelStore((s) => s.restoreSecondary);

  if (!secondary || secondary.mode !== 'minimized') return null;

  return (
    <button
      className="rv-secondary-dock-btn"
      onClick={restoreSecondary}
      title={`Restore chat (${secondary.threadId.slice(0, 8)})`}
      aria-label="Restore secondary chat"
    >
      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
        chat_bubble
      </span>
    </button>
  );
}
