/**
 * @module useChatSessionActions
 * @role Exact-session command projection for one connected chat surface.
 *
 * Commands snapshot store state at invocation. This hook does not subscribe a
 * shell or presentation parent to draft, transcript, or live-turn state.
 */

import { useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { openDiagnostics } from '../../lib/diagnostics/tabs';
import { chatSurfaceDomId } from './chatSurfaceContract';
import { usePanelStore } from '../../state/panelStore';
import { chatAttachmentOwnerKey, useChatFileLinkStore } from '../../state/chatFileLinkStore';
import { chatComposerDraftOwnerKey, useChatComposerDraftStore } from '../../state/chatComposerDraftStore';
import {
  chatSubmissionOwnerKey,
  mintChatSubmissionRequestId,
  useChatSubmissionStore,
} from '../../state/chatSubmissionStore';
import {
  hasAcceptedPromptExecutionWatch,
  requestPromptStatus,
  trackPromptAttempt,
} from '../../lib/chat/prompt-submission-recovery';
import {
  copyGroupLink,
  moveGroupToSide,
  renameGroup,
  selectGroupModel,
  viewGroupMarkdown,
} from '../../lib/chat/thread-group-command-controller';
import { dispatchChatAction } from '../../lib/chat-action';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';
import {
  requestChatTurnDiagnostic,
  type ChatDiagnosticRouteIds,
} from '../../lib/ws/chat-diagnostic-handlers';
import { writeAndRecord } from '../../clipboard/clipboard-api';
import {
  acknowledgedHarnessConfigForThread,
  selectionForThread,
} from '../../state/slices/chatSurfaceSlice';
import type { ChatSurfaceActions, ChatSurfaceHostKind } from './chatSurfaceContract';
import { sendChatProduct } from '../../lib/ws/product-send';

interface UseChatSessionActionsOptions {
  panel: string;
  workspaceId: string;
  viewId: string;
  threadGroupId: string;
  threadId: string;
  surfaceId: string;
  host: ChatSurfaceHostKind;
  expectedPrimarySequence: number | null;
  isActive: boolean;
  selectableHarnessCount: number;
  setCliPickerOpen: Dispatch<SetStateAction<boolean>>;
  focusInput: () => void;
  insertText: (text: string) => void;
}

export interface ChatSessionActionProjection {
  actions: Omit<ChatSurfaceActions, 'onActivate'>;
  onToggleThreads: () => void;
  onToggleContent: () => void;
}

export function useChatSessionActions({
  panel,
  workspaceId,
  viewId,
  threadGroupId,
  threadId,
  surfaceId,
  host,
  expectedPrimarySequence,
  isActive,
  selectableHarnessCount,
  setCliPickerOpen,
  focusInput,
  insertText,
}: UseChatSessionActionsOptions): ChatSessionActionProjection {
  const sendMessage = usePanelStore((state) => state.sendMessage);
  const warmThread = usePanelStore((state) => state.warmThread);
  const finalizeTurn = usePanelStore((state) => state.finalizeTurn);
  const setConnectingHarnessForSurface = usePanelStore(
    (state) => state.setConnectingHarnessForSurface,
  );
  const addPendingAttachment = useChatFileLinkStore((state) => state.addPendingAttachment);

  const hasPendingAcceptance = useCallback((targetThreadId: string) => {
    if (!targetThreadId || !workspaceId) return false;
    const phase = useChatSubmissionStore.getState().attemptsByOwner[
      chatSubmissionOwnerKey(workspaceId, targetThreadId)
    ]?.phase;
    return phase === 'pending' || phase === 'unknown';
  }, [workspaceId]);

  const warmCurrentThread = useCallback(() => {
    if (!threadId || !isActive || hasPendingAcceptance(threadId)) return;
    warmThread(threadId);
  }, [hasPendingAcceptance, isActive, threadId, warmThread]);

  const handleSend = useCallback((text: string) => {
    if (!threadId || !workspaceId || hasPendingAcceptance(threadId)) return;
    const attachmentKey = chatAttachmentOwnerKey(workspaceId, threadId);
    const attachmentState = useChatFileLinkStore.getState();
    const attachments = attachmentState.pendingAttachmentsByOwner[attachmentKey]?.attachments ?? [];
    const attachmentGenerations = Object.fromEntries(attachments.map((attachment) => [
      attachment.id,
      attachmentState.attachmentGenerationsByOwner[attachmentKey]?.[attachment.id] ?? 0,
    ]));
    const draftRevision = useChatComposerDraftStore.getState().revisionsByOwner[
      chatComposerDraftOwnerKey(workspaceId, threadId)
    ] ?? 0;
    const requestId = mintChatSubmissionRequestId();
    const state = usePanelStore.getState();
    const submission = useChatSubmissionStore.getState();
    const priorTurnId = state.projectChats[threadId]?.currentTurn?.id ?? null;
    const attempt = {
      workspaceId,
      threadId,
      requestId,
      text,
      draftRevision,
      attachmentIds: attachments.map((attachment) => attachment.id),
      attachmentGenerations,
      phase: 'pending',
    } as const;
    if (!submission.stageProvisional(attempt)) return;
    const outcome = sendMessage(text, threadId, attachments, {
      requestId,
      harnessConfig: acknowledgedHarnessConfigForThread(state, threadId),
    });
    if (outcome.status === 'not_enqueued') {
      if (submission.discardProvisional(workspaceId, threadId, requestId)) {
        submission.feedback(workspaceId, threadId,
          'Message not sent. Check the connection and try again.');
      }
      return;
    }
    if (priorTurnId && usePanelStore.getState().projectChats[threadId]?.currentTurn?.id === priorTurnId) {
      finalizeTurn(threadId);
    }
    if (submission.promoteProvisional(workspaceId, threadId, requestId)) {
      if (outcome.status === 'uncertain') submission.unknown(workspaceId, threadId, requestId);
      const promoted = useChatSubmissionStore.getState().attemptsByOwner[
        chatSubmissionOwnerKey(workspaceId, threadId)
      ];
      if (promoted?.requestId === requestId) trackPromptAttempt(promoted);
    }
  }, [finalizeTurn, hasPendingAcceptance, sendMessage, threadId, workspaceId]);

  const handleCheckSubmissionStatus = useCallback(() => {
    if (threadId) requestPromptStatus(workspaceId, threadId);
  }, [threadId, workspaceId]);

  const handleAddAttachment = useCallback((attachment: ChatLinkAttachment) => {
    if (!threadId) return;
    warmCurrentThread();
    addPendingAttachment(workspaceId, threadId, attachment);
    focusInput();
  }, [addPendingAttachment, focusInput, threadId, warmCurrentThread, workspaceId]);

  const handleInsertText = useCallback((text: string) => {
    warmCurrentThread();
    insertText(text);
  }, [insertText, warmCurrentThread]);

  const groupAddress = useMemo(
    () => ({ workspaceId, threadGroupId, threadId }),
    [threadGroupId, threadId, workspaceId],
  );
  const handleModelSelectionChange = useCallback(
    (patch: { modelId?: string | null; variant?: string | null }) => {
      selectGroupModel(groupAddress, patch);
    },
    [groupAddress],
  );
  const handleCopyLink = useCallback(() => copyGroupLink(groupAddress), [groupAddress]);
  const handleRename = useCallback((name: string) => renameGroup(groupAddress, name), [groupAddress]);
  const handleOpenDiagnostics = useCallback(() => openDiagnostics({ workspaceId, viewId, threadGroupId, threadId,
    surfaceId: `chat-scroll-${chatSurfaceDomId(surfaceId)}` }), [workspaceId, viewId, threadGroupId, threadId, surfaceId]);
  const handleViewMarkdown = useCallback(() => viewGroupMarkdown(groupAddress), [groupAddress]);
  const handleMoveToSideChat = useCallback(() => {
    if (expectedPrimarySequence === null || !threadId) return;
    const state = usePanelStore.getState();
    const exactChat = state.projectChats[threadId];
    const attempt = useChatSubmissionStore.getState().attemptsByOwner[
      chatSubmissionOwnerKey(workspaceId, threadId)
    ];
    if (exactChat?.currentTurn || exactChat?.pendingTurnEnd || exactChat?.pendingExchangeSaveTurnId) return;
    if (attempt?.phase === 'pending' || attempt?.phase === 'unknown'
      || (attempt?.phase === 'accepted'
        && hasAcceptedPromptExecutionWatch(workspaceId, threadId, attempt.requestId))) return;
    if (selectionForThread(state, threadId).pending !== null) return;
    moveGroupToSide(groupAddress, expectedPrimarySequence);
  }, [expectedPrimarySequence, groupAddress, threadId, workspaceId]);

  const handleStop = useCallback(() => {
    const state = usePanelStore.getState();
    if (!threadId || !state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    const chat = state.projectChats[threadId];
    if (!chat?.currentTurn) return;
    const stopTurnId = chat.currentTurn.id;
    const priorPendingSave = chat.pendingExchangeSaveTurnId ?? null;
    state.setPendingExchangeSave(threadId, stopTurnId);
    const outcome = sendChatProduct({ type: 'turn:stop', threadId },
      { workspaceId, policy: 'socket_only', expectedSocket: state.ws });
    if (outcome.status === 'not_enqueued'
      && usePanelStore.getState().projectChats[threadId]?.pendingExchangeSaveTurnId === stopTurnId) {
      usePanelStore.getState().setPendingExchangeSave(threadId, priorPendingSave);
    }
  }, [threadId, workspaceId]);

  const handleCreateThread = useCallback(() => {
    if (selectableHarnessCount > 1) {
      setCliPickerOpen(true);
      return;
    }
    const socket = usePanelStore.getState().ws;
    const result = sendChatProduct({ type: 'thread:open-assistant', viewId },
      { workspaceId, policy: 'socket_only', expectedSocket: socket });
    if (result.status !== 'not_enqueued') usePanelStore.getState().requestNewChatActivation(workspaceId, viewId);
  }, [selectableHarnessCount, setCliPickerOpen, viewId, workspaceId]);

  const handleHarnessSelect = useCallback((harnessId: string, modelId?: string) => {
    setConnectingHarnessForSurface(surfaceId, harnessId);
    const socket = usePanelStore.getState().ws;
    const outcome = sendChatProduct({
        type: 'thread:open-assistant',
        viewId,
        harnessId,
        ...(modelId ? { harnessConfig: { model: modelId } } : {}),
      }, { workspaceId, policy: 'socket_only', expectedSocket: socket });
    if (outcome.status === 'not_enqueued') usePanelStore.getState().clearConnectingHarnessForSurface(surfaceId);
    else usePanelStore.getState().requestNewChatActivation(workspaceId, viewId);
    setCliPickerOpen(false);
  }, [setCliPickerOpen, setConnectingHarnessForSurface, surfaceId, viewId, workspaceId]);

  const handleToggleThreads = useCallback(() => {
    if (host === 'side-tab') {
      usePanelStore.getState().toggleCollapsed(viewId, 'leftSidebar');
      return;
    }
    usePanelStore.getState().toggleCollapsed(panel, 'leftSidebar');
  }, [host, panel, viewId, workspaceId]);

  const handleToggleContent = useCallback(() => {
    usePanelStore.getState().toggleCollapsed(panel, 'contentArea');
  }, [panel]);
  const handleRequestDiagnostic = useCallback(
    (route: ChatDiagnosticRouteIds) => requestChatTurnDiagnostic(route),
    [],
  );
  const handleCopyDiagnostic = useCallback(async (text: string) => {
    await writeAndRecord(text, 'chat-diagnostic');
  }, []);
  const handleAskAIWithDiagnostic = useCallback(async (text: string): Promise<boolean | 'pending-acceptance'> => {
    if (!threadGroupId || !threadId) return false;
    const phase = useChatSubmissionStore.getState().attemptsByOwner[
      chatSubmissionOwnerKey(workspaceId, threadId)
    ]?.phase;
    if (phase === 'pending') return 'pending-acceptance';
    const result = await dispatchChatAction({
      content: text,
      target: 'current',
      delivery: 'insert',
      address: { workspaceId, viewId, threadGroupId, threadId, surfaceId },
    });
    if (result.status === 'failed' && result.reason === 'busy') return 'pending-acceptance';
    return result.status === 'applied';
  }, [surfaceId, threadGroupId, threadId, viewId, workspaceId]);

  const handleToggleCliPicker = useCallback(
    () => setCliPickerOpen((value) => !value),
    [setCliPickerOpen],
  );
  const handleCloseCliPicker = useCallback(() => setCliPickerOpen(false), [setCliPickerOpen]);

  const actions = useMemo<Omit<ChatSurfaceActions, 'onActivate'>>(() => ({
    onSend: handleSend,
    onCheckSubmissionStatus: handleCheckSubmissionStatus,
    onStop: handleStop,
    onWarmIntent: warmCurrentThread,
    onInsertText: handleInsertText,
    onAddAttachment: handleAddAttachment,
    onCreateThread: handleCreateThread,
    onHarnessSelect: handleHarnessSelect,
    onToggleContent: handleToggleContent,
    onToggleCliPicker: handleToggleCliPicker,
    onCloseCliPicker: handleCloseCliPicker,
    onRename: handleRename,
    onCopyLink: handleCopyLink,
    onViewMarkdown: handleViewMarkdown,
    onOpenDiagnostics: handleOpenDiagnostics,
    onMoveToSideChat: handleMoveToSideChat,
    onModelSelectionChange: handleModelSelectionChange,
    onRequestDiagnostic: handleRequestDiagnostic,
    onCopyDiagnostic: handleCopyDiagnostic,
    onAskAIWithDiagnostic: handleAskAIWithDiagnostic,
  }), [
    handleAddAttachment,
    handleAskAIWithDiagnostic,
    handleCheckSubmissionStatus,
    handleCloseCliPicker,
    handleCopyDiagnostic,
    handleCopyLink,
    handleCreateThread,
    handleHarnessSelect,
    handleInsertText,
    handleModelSelectionChange,
    handleMoveToSideChat,
    handleRename,
    handleRequestDiagnostic,
    handleSend,
    handleStop,
    handleToggleCliPicker,
    handleToggleContent,
    handleViewMarkdown,
    handleOpenDiagnostics,
    warmCurrentThread,
  ]);

  return { actions, onToggleThreads: handleToggleThreads, onToggleContent: handleToggleContent };
}
