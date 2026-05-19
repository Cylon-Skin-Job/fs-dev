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
  | 'handleInsertText'
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
  handleInsertText,
  contextUsage,
}: ChatAreaFooterProps) {
  return (
    <div className={`rv-chat-footer${noThread ? ' rv-chat-footer--disabled' : ''}`}>
      <ChatInput
        ref={chatInputRef}
        onSend={handleSend}
        onStop={handleStop}
        disabled={noThread || !isActive}
        placeholder={inputPlaceholder}
        panel={panel}
        isTurnActive={isTurnActive}
      />
      <div className="rv-chat-composer-meta-row">
        <div>
          <ClipboardTrigger onInsert={handleInsertText} />
          <ScreenshotsTrigger onInsert={handleInsertText} />
          <RecentFilesTrigger onInsert={handleInsertText} />
          <EmojiTrigger onInsert={handleInsertText} />
          <MicTrigger onInsert={handleInsertText} />
        </div>
        {isTurnActive ? (
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
          />
        )}
      </div>
      <div className="rv-context-usage-container">
        <div className="rv-context-usage-bar-standalone">
          <div
            className="rv-context-usage-fill"
            style={{ '--ctx-fill': `${Math.min(contextUsage * 100, 100)}%` } as React.CSSProperties}
          />
        </div>
        <span className="rv-context-usage-text">{Math.round(contextUsage * 100)}%</span>
      </div>
    </div>
  );
}
