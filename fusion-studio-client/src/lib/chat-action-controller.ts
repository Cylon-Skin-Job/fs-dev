import { CHAT_ACTION_EVENT, type ChatActionAddress, type ChatActionRequest, type ChatActionResult } from './chat-action';
import { useWorkspaceStore } from '../state/workspaceStore';
import { usePanelStore } from '../state/panelStore';
import { getThreadGroupPopulation } from '../state/slices/chatSurfaceSlice';
import { chatSubmissionOwnerKey, mintChatSubmissionRequestId, useChatSubmissionStore } from '../state/chatSubmissionStore';
import { trackPromptAttempt } from './chat/prompt-submission-recovery';
import { acknowledgedHarnessConfigForThread } from '../state/slices/chatSurfaceSlice';
import { getThreadMembers } from '../state/slices/worksurfaceSlice';
import { showToast } from './toast';
import { consumeChatMaterial } from './chat-material-commit';
import { consumeCreationAction } from './chat-action-creation';

const failure = (reason: Extract<ChatActionResult, { status: 'failed' }>['reason']): ChatActionResult => ({ status: 'failed', reason });

function validCurrentAddress(address: ChatActionAddress | null): address is ChatActionAddress & { threadGroupId: string; threadId: string } {
  if (!address?.workspaceId || !address.viewId || !address.threadGroupId || !address.threadId) return false;
  const state = usePanelStore.getState();
  if (state.activeWorkspaceId !== address.workspaceId) return false;
  const groupRow = getThreadGroupPopulation(state, address.workspaceId, address.viewId)
    .find((row) => row.threadGroupId === address.threadGroupId);
  if (!groupRow) return false;
  return groupRow?.threadId === address.threadId
    || getThreadMembers(state, address.workspaceId, address.threadGroupId)
      .some((member) => member.threadId === address.threadId);
}

/** One command consumer; no mounted surface owns this listener or its result. */
function consumeAction(event: Event): void {
  const detail = (event as CustomEvent).detail;
  if (detail?.kind === 'material') { consumeChatMaterial(detail); return; }
  const request = detail as ChatActionRequest;
  if (!request || typeof request.complete !== 'function' || typeof request.claim !== 'function') return;
  request.claim();
  if (request.target === 'new') {
    consumeCreationAction(request);
    return;
  }
  if (request.promptId) {
    consumeCreationAction(request);
    return;
  }
  if (request.target !== 'current') {
    request.complete(failure('unsupported'));
    return;
  }
  const address = request.capturedAddress;
  if (!validCurrentAddress(address)) {
    request.complete(failure('no_target'));
    return;
  }
  const { workspaceId, threadId } = address;
  const submission = useChatSubmissionStore.getState();
  const phase = submission.attemptsByOwner[chatSubmissionOwnerKey(workspaceId, threadId)]?.phase;
  // Pending acceptance disables this composer. Unknown restores editing, but
  // the unresolved attempt still forbids another Send until status resolves.
  if (phase === 'pending' || (phase === 'unknown' && request.delivery === 'send')) {
    request.complete(failure('busy'));
    return;
  }

  // Current-chat material uses the mounted operation branch above. This older
  // vocabulary retains insert only for explicit new-chat creation/prefill.
  if (request.delivery !== 'send') {
    request.complete(failure('unsupported'));
    return;
  }
  if (typeof request.content !== 'string' || !request.content.length || 'attachment' in request) {
    request.complete(failure('invalid_action'));
    return;
  }
  const state = usePanelStore.getState();
  const requestId = mintChatSubmissionRequestId();
  const outcome = state.sendMessage(request.content, threadId, [], {
    requestId,
    harnessConfig: acknowledgedHarnessConfigForThread(state, threadId),
  });
  if (outcome.status === 'not_enqueued') {
    request.complete(failure('not_enqueued'));
    return;
  }
  const attempt = {
    workspaceId, threadId, requestId, text: request.content,
    // This action did not submit the user's editable composer draft.
    draftRevision: -1, attachmentIds: [], attachmentGenerations: {},
    phase: outcome.status === 'uncertain' ? 'unknown' as const : 'pending' as const,
  };
  if (!submission.begin(attempt)) {
    request.complete(failure('busy'));
    return;
  }
  trackPromptAttempt(attempt);
  if (outcome.status === 'uncertain') {
    submission.feedback(workspaceId, threadId, 'Delivery status unknown. Check status before sending again.');
    showToast('Message delivery status unknown');
    request.complete({ status: 'unknown', address, requestId });
  } else {
    showToast('Message pending server acceptance');
    request.complete({ status: 'pending', address, requestId });
  }
}

let installed = false;

/** App lifetime registration; repeated mounts and StrictMode never add a second consumer. */
export function installChatActionConsumer(): void {
  if (installed) return;
  window.addEventListener(CHAT_ACTION_EVENT, consumeAction);
  useWorkspaceStore.subscribe((state, previous) => {
    if (state.activeWorkspaceId !== previous.activeWorkspaceId || state.workspaceEpoch !== previous.workspaceEpoch
      || state.bindingRevision !== previous.bindingRevision || state.bindingSerial !== previous.bindingSerial
      || state.hasReceivedInit !== previous.hasReceivedInit) usePanelStore.getState().retireMountedChatAuthority();
  });
  installed = true;
}
