/**
 * @module chatScreenshotCapture
 * @role Shared screenshot capture-and-attach controller for header and composer actions.
 */

import { useChatFileLinkStore } from '../state/chatFileLinkStore';
import { usePanelStore } from '../state/panelStore';
import { createSendToChatAttachment } from '../lib/chat-file-links/send-to-chat-reference-label';
import type { ChatLinkAttachment } from '../lib/chat-file-links/file-link-types';
import { showToast } from '../lib/toast';

export const SCREENSHOT_FLASH_EVENT = 'fusion:screenshot-flash';

const CAPTURE_TIMEOUT_MS = 30_000;
const OWNER_CHANGED_MESSAGE = 'Screenshot was not attached because the chat changed.';

export interface ScreenshotAttachmentOwner {
  workspaceId: string;
  threadId: string;
  surface: 'primary' | 'secondary';
}

function currentPrimaryOwner(
  state: ReturnType<typeof usePanelStore.getState>,
): ScreenshotAttachmentOwner | null {
  if (!state.activeWorkspaceId || !state.currentThreadId) return null;
  return {
    workspaceId: state.activeWorkspaceId,
    threadId: state.currentThreadId,
    surface: 'primary',
  };
}

function isCurrentOwner(owner: ScreenshotAttachmentOwner): boolean {
  const state = usePanelStore.getState();
  if (state.activeWorkspaceId !== owner.workspaceId) return false;
  if (owner.surface === 'primary') return state.currentThreadId === owner.threadId;
  return state.secondary?.threadId === owner.threadId
    && state.secondary.mode !== 'minimized';
}

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
          savedPath?: string;
          message?: string;
        };
        if (message.requestId !== requestId) return;
        if (message.type === 'screenshot:file-captured' && message.savedPath) {
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

export async function captureAndAttachScreenshot(
  requestedOwner?: ScreenshotAttachmentOwner,
): Promise<ChatLinkAttachment | null> {
  const panelState = usePanelStore.getState();
  // Snapshot the complete owner and socket from one state read before the
  // first await. Composer callers pass their exact primary/secondary owner;
  // global capture defaults to the primary owner from this same read.
  const owner = requestedOwner ?? currentPrimaryOwner(panelState);
  const socket = panelState.ws;
  const capturePage = window.electronAPI?.capturePage;

  if (!owner || !isCurrentOwner(owner)) {
    showToast(OWNER_CHANGED_MESSAGE);
    return null;
  }
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
    if (!isCurrentOwner(owner)) {
      showToast(OWNER_CHANGED_MESSAGE);
      return null;
    }

    const dataUrl = `data:image/png;base64,${base64}`;
    window.dispatchEvent(new CustomEvent<string>(SCREENSHOT_FLASH_EVENT, { detail: dataUrl }));

    const savedPath = await waitForSavedScreenshot(socket, owner.workspaceId, dataUrl);
    if (!isCurrentOwner(owner)) {
      showToast(OWNER_CHANGED_MESSAGE);
      return null;
    }
    const name = screenshotName(savedPath);
    const attachment = createSendToChatAttachment({
      panel: 'screenshots',
      relativePath: `Data/Screenshots/${name}`,
      absolutePath: savedPath,
    });

    useChatFileLinkStore.getState().addPendingAttachment(
      owner.workspaceId,
      owner.threadId,
      attachment,
    );

    const currentState = usePanelStore.getState();
    if (currentState.chatActive) {
      currentState.warmThread(owner.threadId);
    }

    showToast('Screenshot attached to chat.');
    return attachment;
  } catch (error) {
    console.error('[ScreenshotCapture] capture-and-attach failed:', error);
    showToast(error instanceof Error ? error.message : 'Screenshot capture failed.');
    return null;
  }
}
