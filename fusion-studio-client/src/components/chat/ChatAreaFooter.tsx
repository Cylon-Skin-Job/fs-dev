/**
 * @module ChatAreaFooter
 * @role Chat composer — input, tool triggers, send/stop, context usage bar.
 */

import { ChatInput } from '../ChatInput';
import { ClipboardTrigger } from '../../clipboard';
import { ScreenshotsTrigger } from '../../screenshots';
import { RecentFilesTrigger } from '../../recent-files';
import { EmojiTrigger } from '../../emojis';
import { MicTrigger } from '../../mic';
import { SendButtonGroup } from './SendButtonGroup';
import { ChatLinkAttachments } from './ChatLinkAttachments';
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
  | 'warmCurrentThread'
  | 'contextUsage'
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
  warmCurrentThread,
  contextUsage,
}: ChatAreaFooterProps) {
  const contextPercent = Math.round(contextUsage * 100);
  const contextFill = `${Math.min(contextUsage * 100, 100)}%`;

  return (
    <div className={`rv-chat-footer${noThread ? ' rv-chat-footer--disabled' : ''}`}>
      <div className="rv-chat-above-input-row">
        <div className="rv-context-usage-container">
          <div className="rv-context-usage-bar-standalone">
            <div
              className="rv-context-usage-fill"
              style={{ '--ctx-fill': contextFill } as React.CSSProperties}
            />
          </div>
          <span className="rv-context-usage-text">tokens · {contextPercent}%</span>
        </div>
        <div className="rv-chat-attachments-strip" aria-label="Chat attachments">
          <ChatLinkAttachments />
        </div>
      </div>
      <ChatInput
        ref={chatInputRef}
        onSend={handleSend}
        onStop={handleStop}
        disabled={noThread || !isActive || isAcceptancePending || isTurnFinalizing}
        placeholder={inputPlaceholder}
        panel={panel}
        isTurnActive={isTurnActive}
        onWarmIntent={warmCurrentThread}
      />
      <div className="rv-chat-composer-meta-row">
        <div>
          <ClipboardTrigger onInsert={handleInsertText} />
          <ScreenshotsTrigger onInsert={handleInsertText} />
          <RecentFilesTrigger onInsert={handleInsertText} />
          <EmojiTrigger onInsert={handleInsertText} />
          <MicTrigger onInsert={handleInsertText} />
        </div>
        {isTurnFinalizing ? (
          <div
            className="rv-chat-completing-indicator"
            aria-label="Completing"
            title="Completing"
          >
            <img src="/assets/chat-completing-pinwheel.gif" alt="" aria-hidden="true" />
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
  );
}
