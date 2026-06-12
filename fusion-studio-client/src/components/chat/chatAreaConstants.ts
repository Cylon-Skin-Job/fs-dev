import { usePanelStore } from '../../state/panelStore';
import type { Message, PanelState, StreamSegment } from '../../types';

/** Stable empty refs so Zustand selectors don't return fresh `[]` each render. */
export const EMPTY_MESSAGES: Message[] = [];
export const EMPTY_SEGMENTS: StreamSegment[] = [];

export function selectChatState(tid: string | null) {
  return (state: ReturnType<typeof usePanelStore.getState>): PanelState | undefined => {
    return tid ? state.projectChats[tid] : undefined;
  };
}
