/**
 * @module ChatAreaFooter
 * @role Chat composer — input, tool triggers, send/stop, context usage bar.
 */

import { ChatInput } from '../ChatInput';
import { MicTrigger } from '../../mic';
import { SendButtonGroup } from './SendButtonGroup';
import { ChatLinkAttachments } from './ChatLinkAttachments';
import { ChatComposerAddMenu } from './ChatComposerAddMenu';
import { ChatComposerModeMenu } from './ChatComposerModeMenu';
import { ChatComposerModelMenu } from './ChatComposerModelMenu';
import { ChatComposerContextMeter } from './ChatComposerContextMeter';
import type { useChatArea } from './useChatArea';

type ChatAreaFooterProps = Pick<
  ReturnType<typeof useChatArea>,
  | 'panel'
  | 'chatInputRef'
  | 'handleSend'
  | 'handleStop'
  | 'noThread'
  | 'isActive'
  | 'inputPlaceholder'
  | 'isTurnActive'
  | 'isTurnFinalizing'
  | 'isAcceptancePending'
  | 'handleInsertText'
  | 'handleAddAttachment'
  | 'warmCurrentThread'
  | 'contextUsage'
  | 'tokenUsage'
  | 'activeWorkspaceId'
  | 'currentThreadId'
  | 'composerDraft'
  | 'handleComposerDraftChange'
  | 'screenshotOwner'
>;

export function ChatAreaFooter({
  panel,
  chatInputRef,
  handleSend,
  handleStop,
  noThread,
  isActive,
  inputPlaceholder,
  isTurnActive,
  isTurnFinalizing,
  isAcceptancePending,
  handleInsertText,
  handleAddAttachment,
  warmCurrentThread,
  contextUsage,
  tokenUsage,
  activeWorkspaceId,
  currentThreadId,
  composerDraft,
  handleComposerDraftChange,
  screenshotOwner,
}: ChatAreaFooterProps) {
  return (
    <div className={`rv-chat-footer${noThread ? ' rv-chat-footer--disabled' : ''}`}>
      <div className="rv-chat-composer-shell">
        <ChatLinkAttachments workspaceId={activeWorkspaceId} threadId={currentThreadId} />
        <ChatInput
          ref={chatInputRef}
          onSend={handleSend}
          onStop={handleStop}
          disabled={noThread || !isActive || isAcceptancePending || isTurnFinalizing}
          placeholder={inputPlaceholder}
          panel={panel}
          isTurnActive={isTurnActive}
          onWarmIntent={warmCurrentThread}
          draftText={composerDraft}
          onDraftChange={handleComposerDraftChange}
        />
        <div className="rv-chat-composer-meta-row">
          <div className="rv-chat-composer-tools-left">
            <ChatComposerAddMenu
              onAttach={handleAddAttachment}
              onInsert={handleInsertText}
              screenshotOwner={screenshotOwner}
            />
            <ChatComposerModeMenu />
          </div>
          <div className="rv-chat-composer-actions">
            <ChatComposerContextMeter contextUsage={contextUsage} tokenUsage={tokenUsage} />
            <ChatComposerModelMenu />
            <MicTrigger onInsert={handleInsertText} />
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
                onClick={handleStop}
                title="Stop generating"
              >
                <span className="material-symbols-outlined rv-icon-md">
                  stop
                </span>
              </button>
            ) : (
              <SendButtonGroup
                chatInputRef={chatInputRef}
                onSend={handleSend}
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
