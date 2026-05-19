import '../styles/dropdown.css';
import './ChatArea.css';
import { MessageList } from './MessageList';
import { ConnectingOverlay } from './ConnectingOverlay';
import { ChatAreaHeader } from './chat/ChatAreaHeader';
import { ChatAreaFooter } from './chat/ChatAreaFooter';
import { useChatArea } from './chat/useChatArea';
import type { Scope } from '../types';

interface ChatAreaProps {
  panel: string;
  scope: Scope;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  /**
   * When set, ChatArea reads/writes chat state for this specific thread
   * instead of currentThreadIds[scope]. Used by the secondary popup.
   */
  threadIdOverride?: string | null;
}

export function ChatArea({ panel, scope, collapsed, sidebarCollapsed, threadIdOverride }: ChatAreaProps) {
  const chat = useChatArea({ panel, scope, threadIdOverride });

  const sectionClass = `rv-chat-area rv-chat-area--${scope}${chat.isActive ? ' rv-chat-area--active' : ' rv-chat-area--inactive'}${chat.noThread ? ' rv-chat-area--no-thread' : ''}`;
  const isSecondary = !!threadIdOverride;

  if (collapsed) {
    return (
      <section className={`rv-chat-area rv-chat-area--${scope} rv-chat-area--collapsed`}>
        <button
          className="rv-collapse-rail-btn"
          onClick={() => chat.toggleCollapsed(panel, 'leftChat')}
          title="Expand chat"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      {!isSecondary && (
        <ChatAreaHeader
          {...chat}
          sidebarCollapsed={sidebarCollapsed}
        />
      )}
      <div className="rv-chat-messages" ref={chat.chatContainerRef}>
        {chat.connectingHarnessId ? (
          <ConnectingOverlay harnessName={chat.connectingHarness?.name} />
        ) : chat.messages.length === 0 && !chat.currentTurn && !chat.showOrb ? (
          <div className="rv-message rv-message-system">
            {chat.noThread ? 'No thread selected' : 'Start a conversation'}
          </div>
        ) : (
          <MessageList
            panel={panel}
            scope={scope}
            threadId={chat.currentThreadId}
            messages={chat.messages}
            currentTurn={chat.currentTurn}
            segments={chat.segments}
            lastUserMsgRef={chat.lastUserMsgRef}
            showOrb={chat.showOrb}
          />
        )}

        {!chat.noThread && <div className="rv-chat-scroll-sentinel" />}
      </div>

      <ChatAreaFooter {...chat} />
    </section>
  );
}
