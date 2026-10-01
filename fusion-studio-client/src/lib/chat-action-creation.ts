import { dispatchChatAction, type ChatActionAddress, type ChatActionRequest, type ChatActionResult } from './chat-action';
import { onFusionResponse } from './ws-client';
import { sendChatProduct } from './ws/product-send';
import { useWorkspaceStore } from '../state/workspaceStore';
import { usePanelStore } from '../state/panelStore';
import { chatComposerDraftOwnerKey, useChatComposerDraftStore } from '../state/chatComposerDraftStore';

type ActionFrame = {
  type: string;
  requestId?: string | null;
  workspaceId?: string;
  workspaceEpoch?: string;
  threadId?: string;
  threadGroupId?: string;
  viewId?: string | null;
  content?: string;
};

const ACTION_TIMEOUT_MS = 15_000;
let sequence = 0;

/** Request resources live here, outside the invoking React mount. */
export function consumeCreationAction(request: ChatActionRequest): void {
  const origin = request.capturedAddress;
  const binding = useWorkspaceStore.getState();
  const panel = usePanelStore.getState();
  if (!origin?.workspaceId || !origin.viewId || origin.workspaceId !== binding.activeWorkspaceId
    || origin.workspaceId !== panel.activeWorkspaceId || !binding.workspaceEpoch
    || !binding.hasReceivedInit || !panel.ws || panel.ws.readyState !== WebSocket.OPEN) {
    request.complete({ status: 'failed', reason: 'no_target' });
    return;
  }
  if (request.signal?.aborted) {
    request.complete({ status: 'cancelled', address: origin });
    return;
  }

  const epoch = binding.workspaceEpoch;
  const socket = panel.ws;
  const requestId = `chat-action-${Date.now().toString(36)}-${(++sequence).toString(36)}`;
  const removers: Array<() => void> = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;
  let created: ChatActionAddress | null = null;
  let resolved = request.content;

  const sameBinding = () => {
    const current = useWorkspaceStore.getState();
    return current.activeWorkspaceId === origin.workspaceId
      && current.workspaceEpoch === epoch && current.hasReceivedInit
      && usePanelStore.getState().ws === socket && socket.readyState === WebSocket.OPEN;
  };
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    removers.splice(0).forEach((remove) => remove());
  };
  const finish = (result: ChatActionResult) => {
    if (finished) return;
    finished = true;
    cleanup();
    request.complete(result);
  };
  const cancel = () => {
    if (created) usePanelStore.getState().consumeThreadOpen(
      { workspaceId: created.workspaceId, viewId: created.viewId },
      { threadId: created.threadId!, threadGroupId: created.threadGroupId! },
    );
    finish({ status: 'cancelled', address: created ?? origin, requestId });
  };
  const fail = (reason: Extract<ChatActionResult, { status: 'failed' }>['reason']) =>
    finish({ status: 'failed', reason });
  const matches = (frame: ActionFrame) => frame.requestId === requestId && sameBinding()
    && (!frame.workspaceId || frame.workspaceId === origin.workspaceId)
    && (!frame.workspaceEpoch || frame.workspaceEpoch === epoch);
  const listen = (type: string, callback: (frame: ActionFrame) => void) => {
    removers.push(onFusionResponse<ActionFrame>(type, callback, cancel));
  };
  const send = (frame: Record<string, unknown>) => {
    if (!sameBinding()) { cancel(); return false; }
    const result = sendChatProduct(frame,
      { workspaceId: origin.workspaceId, policy: 'socket_only', expectedSocket: socket });
    if (result.status === 'not_enqueued') { fail('not_enqueued'); return false; }
    return true;
  };
  const finishCreated = () => {
    if (!created || finished || !sameBinding()) { if (!finished) cancel(); return; }
    if (request.delivery === 'send') {
      if (typeof resolved !== 'string' || !resolved.length) { fail('invalid_action'); return; }
      void dispatchChatAction({ content: resolved, target: 'current', delivery: 'send',
        address: created }).then(finish);
      return;
    }
    if (request.delivery === 'insert') {
      if (typeof resolved !== 'string' || !resolved.length) {
        if (!request.promptId && !request.content) { finish({ status: 'applied', address: created }); return; }
        fail('invalid_action'); return;
      }
      const drafts = useChatComposerDraftStore.getState();
      const key = chatComposerDraftOwnerKey(created.workspaceId, created.threadId!);
      const before = drafts.draftsByOwner[key] ?? '';
      const next = before ? `${before}\n\n${resolved}` : resolved;
      drafts.setDraft(created.workspaceId, created.threadId!, next);
      if (useChatComposerDraftStore.getState().draftsByOwner[key] !== next) { fail('invalid_action'); return; }
      finish({ status: 'applied', address: created });
      return;
    }
    fail('invalid_action');
  };

  const create = () => {
    if (finished) return;
    listen('thread:created', (frame) => {
      if (!matches(frame) || !frame.threadId || !frame.threadGroupId
        || frame.viewId !== origin.viewId) return;
      created = { workspaceId: origin.workspaceId, viewId: origin.viewId,
        threadGroupId: frame.threadGroupId, threadId: frame.threadId };
      usePanelStore.getState().requestThreadOpen({ workspaceId: created.workspaceId,
        viewId: created.viewId, threadGroupId: frame.threadGroupId, threadId: frame.threadId });
    });
    listen('thread:opened', (frame) => {
      if (!matches(frame) || !created || frame.threadId !== created.threadId
        || frame.threadGroupId !== created.threadGroupId || frame.viewId !== origin.viewId) return;
      finishCreated();
    });
    listen('error', (frame) => {
      if (!matches(frame)) return;
      // A created group cannot be rolled back by a later open/read failure.
      // Cancel only the pending insertion and keep the committed destination.
      if (created) cancel();
      else fail('invalid_action');
    });
    send({ type: 'thread:open-assistant', requestId,
      viewId: origin.viewId, ...(request.threadName ? { name: request.threadName } : {}) });
  };

  if (request.signal) {
    request.signal.addEventListener('abort', cancel, { once: true });
    removers.push(() => request.signal?.removeEventListener('abort', cancel));
  }
  removers.push(useWorkspaceStore.subscribe((next) => {
    if (next.activeWorkspaceId !== origin.workspaceId || next.workspaceEpoch !== epoch
      || !next.hasReceivedInit) cancel();
  }));
  timer = setTimeout(cancel, ACTION_TIMEOUT_MS);
  if (request.promptId) {
    listen('prompt:resolved', (frame) => {
      if (!matches(frame)) return;
      if (typeof frame.content !== 'string' || !frame.content.length) { fail('invalid_action'); return; }
      resolved = frame.content;
      if (request.target === 'new') create();
      else void dispatchChatAction({ content: resolved, target: 'current',
        delivery: request.delivery, address: origin }).then(finish);
    });
    listen('prompt:resolve_error', (frame) => { if (matches(frame)) fail('invalid_action'); });
    send({ type: 'prompt:resolve', requestId, promptId: request.promptId,
      variables: request.variables ?? {} });
  } else if (request.target === 'new') {
    create();
  } else {
    fail('invalid_action');
  }
}
