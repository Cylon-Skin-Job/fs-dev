import '../styles/dropdown.css';
import './ChatArea.css';
import { MessageList } from './MessageList';
import { ConnectingOverlay } from './ConnectingOverlay';
import { ChatAreaHeader } from './chat/ChatAreaHeader';
import { ChatAreaFooter } from './chat/ChatAreaFooter';
import { TodoDrawer } from './chat/TodoDrawer';
import { useChatArea } from './chat/useChatArea';

interface ChatAreaProps {
  panel: string;
  collapsed?: boolean;
  sidebarCollapsed?: boolean;
  /**
   * When set, ChatArea reads/writes chat state for this specific thread
   * instead of the current workspace thread. Used by the secondary popup.
   */
  threadIdOverride?: string | null;
}

export function ChatArea({ panel, collapsed, sidebarCollapsed, threadIdOverride }: ChatAreaProps) {
  const chat = useChatArea({ panel, threadIdOverride });

  const sectionClass = `rv-chat-area rv-chat-area--project${chat.isActive ? ' rv-chat-area--active' : ' rv-chat-area--inactive'}${chat.noThread ? ' rv-chat-area--no-thread' : ''}`;
  const isSecondary = !!threadIdOverride;

  if (collapsed) {
    return (
      <section className="rv-chat-area rv-chat-area--project rv-chat-area--collapsed">
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
      <div className="rv-chat-messages">
        <div className="rv-chat-scroll-viewport" ref={chat.chatContainerRef}>
          {chat.connectingHarnessId ? (
            <ConnectingOverlay harnessName={chat.connectingHarness?.name} />
          ) : chat.messages.length === 0 && !chat.currentTurn && !chat.showOrb ? (
            <div className="rv-message rv-message-system">
              {chat.noThread ? 'No thread selected' : 'Start a conversation'}
            </div>
          ) : (
            <MessageList
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

        <TodoDrawer threadId={chat.currentThreadId} />
      </div>

      <ChatAreaFooter {...chat} />
    </section>
  );
}
