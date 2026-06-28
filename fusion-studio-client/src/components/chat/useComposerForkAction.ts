/**
 * @module useComposerForkAction
 * @role Composer-level fork button eligibility and WebSocket dispatch.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { usePanelStore } from '../../state/panelStore';
import type { Thread } from '../../types';

interface UseComposerForkActionOptions {
  currentThreadId: string | null;
  currentThread?: Thread;
  isActive: boolean;
  noThread: boolean;
  isAcceptancePending: boolean;
  isTurnActive: boolean;
  isTurnFinalizing: boolean;
  messageCount: number;
}

export function useComposerForkAction({
  currentThreadId,
  currentThread,
  isActive,
  noThread,
  isAcceptancePending,
  isTurnActive,
  isTurnFinalizing,
  messageCount,
}: UseComposerForkActionOptions) {
  const ws = usePanelStore((state) => state.ws);
  const metadataRefreshThreadRef = useRef<string | null>(null);
  const hasOpenCodeSession = useMemo(() => {
    const sessionId = currentThread?.entry.harnessConfig?.opencodeSessionId;
    return typeof sessionId === 'string' && sessionId.trim().length > 0;
  }, [currentThread?.entry.harnessConfig?.opencodeSessionId]);

  useEffect(() => {
    if (!currentThreadId || hasOpenCodeSession || messageCount === 0) return;
    const refreshKey = `${currentThreadId}:${messageCount}`;
    if (
      noThread ||
      !isActive ||
      currentThread?.entry.harnessId !== 'opencode' ||
      isAcceptancePending ||
      isTurnActive ||
      isTurnFinalizing ||
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      metadataRefreshThreadRef.current === refreshKey
    ) {
      return;
    }

    metadataRefreshThreadRef.current = refreshKey;
    const refreshTimer = window.setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'thread:list' }));
      }
    }, 150);

    return () => window.clearTimeout(refreshTimer);
  }, [
    currentThreadId,
    currentThread?.entry.harnessId,
    hasOpenCodeSession,
    isAcceptancePending,
    isActive,
    isTurnActive,
    isTurnFinalizing,
    messageCount,
    noThread,
    ws,
  ]);

  const isForkThreadDisabled = (
    noThread ||
    !isActive ||
    !currentThreadId ||
    currentThread?.entry.harnessId !== 'opencode' ||
    !hasOpenCodeSession ||
    isAcceptancePending ||
    isTurnActive ||
    isTurnFinalizing ||
    !ws ||
    ws.readyState !== WebSocket.OPEN
  );

  const handleForkThread = useCallback(() => {
    if (isForkThreadDisabled || !currentThreadId) return;
    const socket = usePanelStore.getState().ws;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(JSON.stringify({
      type: 'thread:fork',
      sourceThreadId: currentThreadId,
    }));
  }, [currentThreadId, isForkThreadDisabled]);

  return {
    isForkThreadDisabled,
    handleForkThread,
  };
}
