/**
 * @module ThreadedChat
 * @role One explicit composition of a `ThreadRail` and the selected group's
 *       Main Chat `ChatSurface` (SPEC-02 §5.3).
 *
 * `ThreadedChat` is presentation-only: both children receive already-projected
 * props from a connected host. A future Side Chat mounts `ChatSurface` alone
 * and never a second local rail; this module is used by explicit view-bound
 * hosts and the rendered fixtures, while the production Legacy composition
 * keeps the shell's grid tracks for the same two portable components.
 */

import './ThreadedChat.css';
import { ThreadRail, type ThreadRailProps } from './ThreadRail';
import { ChatSurface, type ChatSurfaceComponentProps } from './ChatSurface';

export interface ThreadedChatProps {
  rail: ThreadRailProps;
  chat: ChatSurfaceComponentProps;
}

export function ThreadedChat({ rail, chat }: ThreadedChatProps) {
  return (
    <div className="rv-threaded-chat" data-threaded-chat="true">
      <ThreadRail {...rail} />
      <ChatSurface {...chat} />
    </div>
  );
}
