/**
 * ChatTurnError — pure presentation for ONE durable safe terminal turn error
 * (RCC-0108 SPEC-05 Slice B; parent §4.13).
 *
 * Vocabulary (exact, per §4.13):
 *  - neutral surrounding chat chrome/spacing (no panel/background of its own);
 *  - `Response failed` or `Authentication failed` semibold title using
 *    `var(--error, #ef4444)` — selected by the validated envelope's kind;
 *  - the safe catalog code in muted context text;
 *  - a compact, deduplicated, pre-wrapped safe message in the same
 *    red/error treatment (shared compaction/dedupe helper — a defensive
 *    presentation limit over the already-validated fixed catalog string);
 *  - ONE `role="alert"` announcement when the error appears. The element is
 *    mounted once per row with stable content, so re-renders never repeat
 *    the announcement; a remount (history rehydration) is a NEW appearance.
 *
 * Input contract: `error` is ALWAYS a client-validated envelope
 * (`readMessageTerminalError` / `validateTurnTerminalError`) — this component
 * never receives, inspects, or renders unvalidated bytes. Explicit diagnostic
 * actions render as a sibling outside this single alert region.
 */

import type { TurnTerminalError } from '../../types';
import { compactDedupedSafeErrorText } from '../../lib/tool-renderers/shared/error-display';
import './ChatTurnError.css';

const AUTHENTICATION_TITLE = 'Authentication failed';
const RESPONSE_TITLE = 'Response failed';

interface ChatTurnErrorProps {
  error: TurnTerminalError;
}

export function ChatTurnError({ error }: ChatTurnErrorProps) {
  const title = error.kind === 'authentication' ? AUTHENTICATION_TITLE : RESPONSE_TITLE;
  // Defensive presentation limit over the fixed safe message; the title and
  // code are the row's other presented texts, so the message never repeats
  // them (dedupe is part of the shared helper).
  const message = compactDedupedSafeErrorText(error.message, [title, error.code]);

  return (
    <div className="rv-chat-turn-error" role="alert" data-error-code={error.code}>
      <div className="rv-chat-turn-error-title">{title}</div>
      <div className="rv-chat-turn-error-code">{error.code}</div>
      {message ? (
        <div className="rv-chat-turn-error-message">{message}</div>
      ) : null}
    </div>
  );
}
