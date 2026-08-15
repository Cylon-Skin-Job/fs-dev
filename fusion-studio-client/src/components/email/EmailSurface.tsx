/**
 * @module EmailSurface
 * @role Mail mockup surface: filters stub messages by the active sidebar
 *       mode and composes the 25/75 message list + reading pane split.
 *       Owns the session-only expanded state for the reading pane.
 */

import { useMemo, useState } from 'react';
import { EMAIL_FAKE_MESSAGES } from './emailFakeData';
import { EmailMessageList } from './EmailMessageList';
import { EmailReadingPane } from './EmailReadingPane';
import './EmailSurface.css';

interface EmailSurfaceProps {
  mode: string;
  paperBrightness: number;
  onPaperBrightnessChange: (value: number) => void;
}

export function EmailSurface({ mode, paperBrightness, onPaperBrightnessChange }: EmailSurfaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const messages = useMemo(
    () => EMAIL_FAKE_MESSAGES.filter((message) =>
      mode === 'starred' ? message.starred : message.labels.includes(mode)
    ),
    [mode]
  );

  if (messages.length === 0) {
    return (
      <div className="rv-email-surface rv-email-surface--empty">
        <span className="material-symbols-outlined" aria-hidden="true">inbox</span>
        <span>Nothing here</span>
      </div>
    );
  }

  const selected = messages.find((message) => message.id === selectedId) ?? messages[0];

  return (
    <div className="rv-email-surface">
      <EmailMessageList
        messages={messages}
        selectedId={selected.id}
        onSelect={setSelectedId}
      />
      <EmailReadingPane
        message={selected}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
        paperBrightness={paperBrightness}
        onPaperBrightnessChange={onPaperBrightnessChange}
      />
    </div>
  );
}
