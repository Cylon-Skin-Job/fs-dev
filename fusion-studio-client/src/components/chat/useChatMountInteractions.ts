/** Transient composer refs, focus, scroll and presentation listeners for one mount. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../../state/chatSubmissionStore';
import type { ChatSurfaceRefs } from './chatSurfaceContract';

type SendingTarget = { threadId: string; requestId: string };

export function useChatMountInteractions(
  workspaceId: string | null,
  threadId: string,
) {
  const headerRef = useRef<HTMLDivElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<ChatSurfaceRefs['inputRef']['current']>(null);
  const [sendingTarget, setSendingTarget] = useState<SendingTarget | null>(null);
  const [cliPickerOpen, setCliPickerOpen] = useState(false);

  // These are exact-session visual scroll/orb hints. The session attempt store
  // and recovery controller own admission, status, and resend gating.
  useEffect(() => {
    const handleAccepted = (event: Event) => {
      const detail = (event as CustomEvent<{
        threadId: string; workspaceId: string; requestId: string;
        turnId: string; recoveredFromStatus?: boolean;
      }>).detail;
      if (!detail || detail.workspaceId !== workspaceId || detail.threadId !== threadId) return;
      const attempt = useChatSubmissionStore.getState().attemptsByOwner[
        chatSubmissionOwnerKey(detail.workspaceId, detail.threadId)
      ];
      if (attempt?.requestId !== detail.requestId || attempt.turnId !== detail.turnId
        || detail.recoveredFromStatus) return;
      setSendingTarget({ threadId: detail.threadId, requestId: detail.requestId });
    };
    const handleFailed = (event: Event) => {
      const detail = (event as CustomEvent<{ threadId?: string; workspaceId?: string; requestId?: string }>).detail;
      if (detail?.workspaceId !== workspaceId || detail.threadId !== threadId) return;
      setSendingTarget((target) => (target?.threadId === detail.threadId ? null : target));
    };
    const handleTurnEnded = (event: Event) => {
      const detail = (event as CustomEvent<{ threadId?: string }>).detail;
      if (detail?.threadId === threadId) setSendingTarget(null);
    };
    const handleAcceptedExecutionUnknown = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string; threadId?: string; requestId?: string }>).detail;
      if (!detail || detail.workspaceId !== workspaceId || detail.threadId !== threadId) return;
      const attempt = useChatSubmissionStore.getState().attemptsByOwner[
        chatSubmissionOwnerKey(detail.workspaceId, detail.threadId)
      ];
      if (attempt?.requestId !== detail.requestId || attempt.phase !== 'accepted') return;
      setSendingTarget((target) => (target && target.threadId === detail.threadId
        && target.requestId === detail.requestId ? null : target));
    };
    window.addEventListener('fusion:prompt-accepted', handleAccepted);
    window.addEventListener('fusion:prompt-acceptance-failed', handleFailed);
    window.addEventListener('fusion:prompt-execution-failed', handleAcceptedExecutionUnknown);
    window.addEventListener('fusion:prompt-execution-unknown', handleAcceptedExecutionUnknown);
    window.addEventListener('fusion:turn-ended', handleTurnEnded);
    return () => {
      window.removeEventListener('fusion:prompt-accepted', handleAccepted);
      window.removeEventListener('fusion:prompt-acceptance-failed', handleFailed);
      window.removeEventListener('fusion:prompt-execution-failed', handleAcceptedExecutionUnknown);
      window.removeEventListener('fusion:prompt-execution-unknown', handleAcceptedExecutionUnknown);
      window.removeEventListener('fusion:turn-ended', handleTurnEnded);
    };
  }, [workspaceId, threadId]);

  const focusInput = useCallback(() => inputRef.current?.focus(), []);
  const insertText = useCallback((text: string) => inputRef.current?.insertText(text), []);
  const refs: ChatSurfaceRefs = useMemo(
    () => ({ headerRef, lastUserMsgRef, scrollRef, inputRef }),
    [],
  );
  return {
    refs,
    focusInput,
    insertText,
    cliPickerOpen,
    setCliPickerOpen,
    isSendingForCurrentThread: sendingTarget?.threadId === threadId,
  };
}
