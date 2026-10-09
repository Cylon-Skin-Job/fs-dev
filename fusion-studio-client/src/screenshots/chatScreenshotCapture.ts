/**
 * @module chatScreenshotCapture
 * @role Shared screenshot capture-and-attach controller for header and composer actions.
 */

import { usePanelStore } from '../state/panelStore';
import { beginChatMaterial, commitChatMaterial, validateChatMaterial } from '../lib/chat-action';
import { chatSubmissionOwnerKey, useChatSubmissionStore } from '../state/chatSubmissionStore';
import type { MountedChatBinding } from '../state/slices/mountedChatState';
import { createSendToChatAttachment } from '../lib/chat-file-links/send-to-chat-reference-label';
import type { ChatLinkAttachment } from '../lib/chat-file-links/file-link-types';
import { showToast } from '../lib/toast';

export const SCREENSHOT_FLASH_EVENT = 'fusion:screenshot-flash';
const CAPTURE_TIMEOUT_MS = 30_000;
const OWNER_CHANGED_MESSAGE = 'Screenshot was not attached because the chat changed.';

function screenshotName(savedPath: string): string {
  return savedPath.split(/[\\/]/).pop() || 'screenshot.png';
}

function waitForSavedScreenshot(
  socket: WebSocket,
  workspaceId: string,
  dataUrl: string,
): Promise<string> {
  const requestId = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeoutId);
      socket.removeEventListener('message', handleMessage);
      socket.removeEventListener('close', handleClose);
    };
    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };
    const handleClose = () => fail('Fusion server disconnected while saving the screenshot.');
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as {
          type?: string;
          requestId?: string;
          savedPath?: unknown;
          workspaceId?: string;
          message?: string;
        };
        if (message.requestId !== requestId || (message.workspaceId && message.workspaceId !== workspaceId)) return;
        if (message.type === 'screenshot:file-captured') {
          if (typeof message.savedPath !== 'string' || !message.savedPath.trim()) {
            fail('The saved screenshot path was unavailable.');
            return;
          }
          cleanup();
          resolve(message.savedPath);
          return;
        }
        if (message.type === 'screenshot:error') {
          fail(message.message || 'The screenshot could not be saved.');
        }
      } catch {
        // Ignore unrelated non-JSON WebSocket traffic.
      }
    };
    const timeoutId = window.setTimeout(() => {
      fail('Timed out while saving the screenshot.');
    }, CAPTURE_TIMEOUT_MS);

    socket.addEventListener('message', handleMessage);
    socket.addEventListener('close', handleClose);

    try {
      socket.send(JSON.stringify({
        type: 'screenshot:file-capture',
        requestId,
        workspaceId,
        dataUrl,
      }));
    } catch (error) {
      fail(error instanceof Error ? error.message : 'The screenshot request could not be sent.');
    }
  });
}

/** Source capture/save; destination and the single store mutation belong to Chat material. */
export async function captureAndAttachScreenshot(
  requestedOwner?: MountedChatBinding | null,
): Promise<ChatLinkAttachment | null> {
  const begun = beginChatMaterial(requestedOwner);
  if (begun.status !== 'ready') {
    showToast(begun.status === 'unavailable' && begun.reason === 'busy'
      ? 'Wait for message acceptance' : OWNER_CHANGED_MESSAGE);
    return null;
  }
  const operation = begun.operation, owner = operation.owner;
  // Capture source inputs before native preparation; never resolve another destination.
  const socket = usePanelStore.getState().ws;
  const capturePage = window.electronAPI?.capturePage;
  if (!capturePage) {
    showToast('Screenshot capture is available in the desktop app.');
    return null;
  }
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    showToast('Fusion must be connected before taking a screenshot.');
    return null;
  }
  try {
    const base64 = await capturePage();
    if (!base64) throw new Error('The current window could not be captured.');
    if (validateChatMaterial(operation)) {
      showToast(OWNER_CHANGED_MESSAGE);
      return null;
    }
    // The captured source socket may have retired while native work was pending.
    if (socket.readyState !== WebSocket.OPEN || usePanelStore.getState().ws !== socket) {
      throw new Error('Fusion server disconnected while saving the screenshot.');
    }
    const dataUrl = `data:image/png;base64,${base64}`;
    window.dispatchEvent(new CustomEvent<string>(SCREENSHOT_FLASH_EVENT, { detail: dataUrl }));
    const savedPath = await waitForSavedScreenshot(socket, owner.workspaceId, dataUrl);
    const name = screenshotName(savedPath);
    const attachment = createSendToChatAttachment({
      panel: 'screenshots', relativePath: `Data/Screenshots/${name}`, absolutePath: savedPath,
    });
    const result = await commitChatMaterial(operation, { attachment });
    if (result.status !== 'applied' && result.status !== 'noop') {
      showToast(result.status === 'unavailable' && result.reason === 'busy'
        ? 'Wait for message acceptance' : OWNER_CHANGED_MESSAGE);
      return null;
    }
    // Existing screenshot warming is best effort, independently of local insertion.
    const state = usePanelStore.getState();
    const phase = useChatSubmissionStore.getState().attemptsByOwner[chatSubmissionOwnerKey(owner.workspaceId, owner.threadId)]?.phase;
    if (state.chatActive && phase !== 'pending' && phase !== 'unknown' && !validateChatMaterial(operation)) {
      try { state.warmThread(owner.threadId); } catch { /* Successful insertion stays successful. */ }
    }
    showToast(result.status === 'noop' ? 'Screenshot is already attached to chat.' : 'Screenshot attached to chat.');
    return attachment;
  } catch {
    showToast('Screenshot capture or save failed.');
    return null;
  }
}
