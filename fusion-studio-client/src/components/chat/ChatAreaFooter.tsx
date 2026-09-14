/**
 * @module ChatAreaFooter
 * @role Chat composer — input, tool triggers, send/stop, context usage bar.
 *
 * Portable presentation: explicit state/callbacks from the mount host. The
 * composer model menu receives the exact `threadId`/`surfaceId` so a selection
 * and its pending/acknowledged state can never be read from a different mount
 * (§6.2/§6.3).
 */

import type { RefObject } from 'react';
import { ChatInput } from '../ChatInput';
import { MicTrigger } from '../../mic';
import { SendButtonGroup } from './SendButtonGroup';
import { ChatLinkAttachments } from './ChatLinkAttachments';
import { ChatComposerAddMenu } from './ChatComposerAddMenu';
import { ChatComposerModeMenu } from './ChatComposerModeMenu';
import { ChatComposerModelMenu } from './ChatComposerModelMenu';
import { ChatComposerContextMeter } from './ChatComposerContextMeter';
import type { ChatLinkAttachment } from '../../lib/chat-file-links/file-link-types';
import type { TokenUsage } from '../../types';
import type { ScreenshotAttachmentOwner } from '../../screenshots/chatScreenshotCapture';
import type { ChatSurfaceInputHandle, ChatSurfaceModelSelection } from './chatSurfaceContract';

export interface ChatAreaFooterProps {
  mountId: string;
  panel: string;
  inputRef: RefObject<ChatSurfaceInputHandle | null>;
  onSend: (text: string) => void;
  onStop: () => void;
  noThread: boolean;
  isActive: boolean;
  inputPlaceholder?: string;
  isTurnActive: boolean;
  isTurnFinalizing: boolean;
  isAcceptancePending: boolean;
  onInsertText: (text: string) => void;
  onAddAttachment: (attachment: ChatLinkAttachment) => void;
  onWarmIntent: () => void;
  contextUsage: number;
  tokenUsage: TokenUsage | null;
  workspaceId: string | null;
  threadId: string | null;
  composerDraft: string;
  onComposerDraftChange: (text: string) => void;
  modelSelection: ChatSurfaceModelSelection;
  onModelSelectionChange: (patch: { modelId?: string | null; variant?: string | null }) => void;
  screenshotOwner: ScreenshotAttachmentOwner | null;
}

export function ChatAreaFooter({
  mountId,
  panel,
  inputRef,
  onSend,
  onStop,
  noThread,
  isActive,
  inputPlaceholder,
  isTurnActive,
  isTurnFinalizing,
  isAcceptancePending,
  onInsertText,
  onAddAttachment,
  onWarmIntent,
  contextUsage,
  tokenUsage,
  workspaceId,
  threadId,
  composerDraft,
  onComposerDraftChange,
  modelSelection,
  onModelSelectionChange,
  screenshotOwner,
}: ChatAreaFooterProps) {
  return (
    <div
      className={`rv-chat-footer${noThread ? ' rv-chat-footer--disabled' : ''}`}
      data-chat-mount-id={mountId}
    >
      <div className="rv-chat-composer-shell">
        <ChatLinkAttachments workspaceId={workspaceId} threadId={threadId} />
        <ChatInput
          ref={inputRef}
          onSend={onSend}
          onStop={onStop}
          disabled={noThread || !isActive || isAcceptancePending || isTurnFinalizing}
          placeholder={inputPlaceholder}
          panel={panel}
          isTurnActive={isTurnActive}
          onWarmIntent={onWarmIntent}
          draftText={composerDraft}
          onDraftChange={onComposerDraftChange}
        />
        <div className="rv-chat-composer-meta-row">
          <div className="rv-chat-composer-tools-left">
            <ChatComposerAddMenu
              onAttach={onAddAttachment}
              onInsert={onInsertText}
              screenshotOwner={screenshotOwner}
            />
            <ChatComposerModeMenu />
          </div>
          <div className="rv-chat-composer-actions">
            <ChatComposerContextMeter contextUsage={contextUsage} tokenUsage={tokenUsage} />
            <ChatComposerModelMenu
              threadId={threadId}
              mountId={mountId}
              selection={modelSelection}
              onChangeSelection={onModelSelectionChange}
            />
            <MicTrigger onInsert={onInsertText} />
            {isTurnFinalizing ? (
              <div
                className="rv-chat-completing-indicator"
                aria-label="Completing"
                title="Completing"
              >
                <span className="rv-send-warming-wheel" aria-hidden="true" />
              </div>
            ) : isTurnActive ? (
              <button
                className="rv-chat-footer-btn rv-stop-btn"
                onClick={onStop}
                title="Stop generating"
              >
                <span className="material-symbols-outlined rv-icon-md">
                  stop
                </span>
              </button>
            ) : (
              <SendButtonGroup
                chatInputRef={inputRef}
                onSend={onSend}
                disabled={isAcceptancePending}
                warming={isAcceptancePending}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
