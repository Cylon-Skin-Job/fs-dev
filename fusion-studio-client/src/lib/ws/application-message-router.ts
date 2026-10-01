/** Ordered inbound product-frame selection; existing domain owners apply effects. */
import { useWorkspaceStore } from '../../state/workspaceStore';
import { handleStreamMessage } from './stream-handlers';
import { handleThreadMessage } from './thread-handlers';
import { handlePromptStatusFrame, resumePromptRecoveryConnection } from '../chat/prompt-submission-recovery';
import { sendChatProduct } from './product-send';
import { handleFileMessage } from './file-handlers';
import { handleWorksurfaceMessage } from './worksurface-handlers';
import { handleResourceProvenanceResponse } from './resource-provenance-protocol';
import { handleWorkspaceMessage } from './workspace-handlers';
import { handleHarnessMessage } from './harness-handlers';
import { handleThemeMessage } from './theme-handlers';
import { handleScreenshotMessage } from './screenshot-handlers';
import { handleBookmarksMessage } from './bookmarks-handlers';
import { handleCalendarMessage } from './calendar-handlers';
import { handleOfficePaletteMessage } from './office-palette-handlers';
import { emitFusion } from './fusion-response-listeners';
import { handleViewStateMessage } from './view-state-handlers';
import { handleShellMessage } from './shell-message-handlers';
import { runWithRendererMessageDiagnosticBoundary } from './renderer-diagnostic-boundary';
import type { WebSocketMessage } from '../../types';

function handleMessageWithinDiagnosticBoundary(
  msg: WebSocketMessage,
  isStillCurrent: () => boolean,
  runtimeGeneration: string | null,
) {
  if (
    msg.type === 'chat-turn:metadata:updated' ||
    msg.type === 'chat-turn:metadata:error' ||
    msg.type === 'document_create_response'
  ) {
    emitFusion(msg.type, msg);
  }

  const recoveredAck = handlePromptStatusFrame(msg as Parameters<typeof handlePromptStatusFrame>[0]);
  if (recoveredAck !== false) {
    if (recoveredAck) handleThreadMessage(recoveredAck);
    return;
  }

  // The legacy stream error handler consumes generic `error` frames. Deliver
  // request-qualified creation failures to their command owner first.
  if (msg.type === 'error' && typeof msg.requestId === 'string') emitFusion('error', msg);

  if (handleStreamMessage(msg)) return;
  if (msg.type === 'thread:created' || msg.type === 'thread:opened') {
    const workspace = useWorkspaceStore.getState();
    if ((typeof msg.workspaceId === 'string' && msg.workspaceId !== workspace.activeWorkspaceId)
      || (typeof msg.workspaceEpoch === 'string' && msg.workspaceEpoch !== workspace.workspaceEpoch)) return;
  }
  if (handleThreadMessage(msg)) {
    if (msg.type === 'thread:created' || msg.type === 'thread:opened') emitFusion(msg.type, msg);
    return;
  }
  if (handleWorksurfaceMessage(msg)) return;
  if (handleFileMessage(msg)) return;
  if (handleResourceProvenanceResponse(msg)) return;
  if (handleWorkspaceMessage(msg, { runtimeGeneration, isStillCurrent })) {
    if (msg.type === 'workspace:init') resumePromptRecoveryConnection((frame, workspaceId) =>
      sendChatProduct(frame, { workspaceId, policy: 'auth_queue_allowed' }));
    return;
  }
  if (msg.type === 'prompt:resolved' || msg.type === 'prompt:resolve_error') {
    emitFusion(msg.type, msg);
  }
  if (handleHarnessMessage(msg)) return;
  if (handleThemeMessage(msg)) return;
  if (handleScreenshotMessage(msg)) return;
  if (handleBookmarksMessage(msg)) return;
  if (handleCalendarMessage(msg)) return;
  if (handleOfficePaletteMessage(msg)) return;

  if (handleViewStateMessage(msg)) return;
  handleShellMessage(msg);
}

export function routeApplicationMessage(msg: WebSocketMessage, isStillCurrent: () => boolean, runtimeGeneration: string | null): void {
  if (!isStillCurrent()) return;
  runWithRendererMessageDiagnosticBoundary(() => handleMessageWithinDiagnosticBoundary(msg, isStillCurrent, runtimeGeneration));
}
