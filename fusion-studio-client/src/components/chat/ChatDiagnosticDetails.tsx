/**
 * ChatDiagnosticDetails — explicit controls for one bounded redacted report.
 *
 * The component owns only local interaction state. Retrieval and composer
 * placement are injected callbacks, so mounting/focusing/hydrating this row
 * cannot fetch a report or send a prompt.
 */

import { useEffect, useRef, useState } from 'react';
import { isValidDiagnosticId } from '../../lib/chat/terminal-error';
import {
  formatChatTurnDiagnosticReport,
  type ValidatedChatTurnDiagnosticReport,
} from '../../lib/chat/diagnostic-report';
import type { ChatDiagnosticRouteIds } from '../../lib/ws/chat-diagnostic-handlers';
import './ChatDiagnosticDetails.css';

const UNAVAILABLE_MESSAGE = 'Diagnostic details are unavailable.';
const ASK_AI_INTRO = 'Please help me troubleshoot this failed model response using the redacted diagnostic below. Suggest safe next steps.\n\n';

type DiagnosticState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'copied'
  | 'copy-failed'
  | 'composer-busy'
  | 'inserted'
  | 'unavailable';

interface KeyedState {
  identity: string;
  state: DiagnosticState;
}

interface KeyedReport {
  identity: string;
  report: ValidatedChatTurnDiagnosticReport;
}

interface ResolvedDiagnostic {
  report: ValidatedChatTurnDiagnosticReport;
  text: string;
}

interface ChatDiagnosticDetailsProps extends ChatDiagnosticRouteIds {
  onRequest: (route: ChatDiagnosticRouteIds) => Promise<ValidatedChatTurnDiagnosticReport | null>;
  onCopy: (text: string) => Promise<void>;
  onAskAI: (text: string) => boolean;
  askAIEnabled: boolean;
}

export function ChatDiagnosticDetails({
  threadId,
  turnId,
  diagnosticId,
  onRequest,
  onCopy,
  onAskAI,
  askAIEnabled,
}: ChatDiagnosticDetailsProps) {
  const identity = `${threadId}\u0000${turnId}\u0000${diagnosticId}`;
  const identityRef = useRef(identity);
  const requestGeneration = useRef(0);
  const inFlightRequest = useRef<{
    identity: string;
    promise: Promise<ResolvedDiagnostic | null>;
  } | null>(null);
  const mounted = useRef(true);
  const [keyedState, setKeyedState] = useState<KeyedState>({ identity, state: 'idle' });
  const [keyedReport, setKeyedReport] = useState<KeyedReport | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    identityRef.current = identity;
    requestGeneration.current += 1;
  }, [identity]);

  if (!isValidDiagnosticId(diagnosticId) || threadId.length === 0 || turnId.length === 0) {
    return null;
  }

  const state = keyedState.identity === identity ? keyedState.state : 'idle';
  const report = keyedReport?.identity === identity ? keyedReport.report : null;
  const reportText = report ? formatChatTurnDiagnosticReport(report) : null;

  const resolveReport = (): Promise<ResolvedDiagnostic | null> => {
    if (report && reportText) return Promise.resolve({ report, text: reportText });
    const existing = inFlightRequest.current;
    if (existing?.identity === identity) return existing.promise;
    if (state === 'unavailable') return Promise.resolve(null);

    const generation = requestGeneration.current + 1;
    requestGeneration.current = generation;
    setKeyedState({ identity, state: 'loading' });
    const pending = (async (): Promise<ResolvedDiagnostic | null> => {
      let retrieved: ValidatedChatTurnDiagnosticReport | null = null;
      try {
        retrieved = await onRequest({ threadId, turnId, diagnosticId });
      } catch {
        retrieved = null;
      }
      if (!mounted.current || identityRef.current !== identity || requestGeneration.current !== generation) {
        return null;
      }
      const text = formatChatTurnDiagnosticReport(retrieved);
      if (!retrieved || !text) {
        setKeyedReport(null);
        setKeyedState({ identity, state: 'unavailable' });
        return null;
      }
      setKeyedReport({ identity, report: retrieved });
      setKeyedState({ identity, state: 'ready' });
      return { report: retrieved, text };
    })();
    const record = { identity, promise: pending };
    inFlightRequest.current = record;
    void pending.finally(() => {
      if (inFlightRequest.current === record) inFlightRequest.current = null;
    });
    return pending;
  };

  const handleView = async () => {
    await resolveReport();
  };

  const handleCopy = async () => {
    const resolved = await resolveReport();
    if (!resolved) return;
    try {
      await onCopy(resolved.text);
      if (mounted.current && identityRef.current === identity) {
        setKeyedState({ identity, state: 'copied' });
      }
    } catch {
      if (mounted.current && identityRef.current === identity) {
        // Clipboard capability/permission is independent of report validity.
        // Retain the validated report and leave every action usable.
        setKeyedState({ identity, state: 'copy-failed' });
      }
    }
  };

  const handleAskAI = async () => {
    const resolved = await resolveReport();
    if (!resolved) return;
    if (mounted.current && identityRef.current === identity) {
      setKeyedState({
        identity,
        state: onAskAI(`${ASK_AI_INTRO}${resolved.text}`) ? 'inserted' : 'composer-busy',
      });
    }
  };

  const disabled = state === 'loading' || state === 'unavailable';

  return (
    <div className="rv-chat-diagnostic-details">
      <div className="rv-chat-diagnostic-actions" aria-label="Diagnostic actions">
        <button type="button" onClick={handleView} disabled={disabled}>View</button>
        <button type="button" onClick={handleCopy} disabled={disabled}>Copy</button>
        <button type="button" onClick={handleAskAI} disabled={disabled || !askAIEnabled}>Ask AI</button>
      </div>
      {state === 'loading' ? (
        <div className="rv-chat-diagnostic-status">Loading diagnostic…</div>
      ) : state === 'unavailable' ? (
        <div className="rv-chat-diagnostic-status">{UNAVAILABLE_MESSAGE}</div>
      ) : state === 'copied' ? (
        <div className="rv-chat-diagnostic-status">Diagnostic copied.</div>
      ) : state === 'copy-failed' ? (
        <div className="rv-chat-diagnostic-status">Unable to copy diagnostic.</div>
      ) : state === 'composer-busy' ? (
        <div className="rv-chat-diagnostic-status">Wait for the current message to be accepted, then try again.</div>
      ) : state === 'inserted' ? (
        <div className="rv-chat-diagnostic-status">Diagnostic added to the composer for review.</div>
      ) : null}
      {reportText ? <pre className="rv-chat-diagnostic-report">{reportText}</pre> : null}
    </div>
  );
}
