/**
 * @module ws/worksurface-handlers
 * @role Handle registered group-worksurface frames (CHAT-03 / SPEC-03 §6).
 *
 * Correlation, CAS, and selection live in the worksurface controller; this
 * module only routes the three `state:worksurface_*` frame types and rejects a
 * fan-out that belongs to another workspace.
 */

import { usePanelStore } from '../../state/panelStore';
import {
  handleWorksurfaceChangedFrame,
  handleWorksurfaceErrorFrame,
  handleWorksurfaceResultFrame,
} from '../worksurface/worksurfaceController';
import type {
  WorksurfaceChangedFrame,
  WorksurfaceErrorFrame,
  WorksurfaceResultFrame,
} from '../worksurface/types';
import type { WebSocketMessage } from '../../types';

export function handleWorksurfaceMessage(msg: WebSocketMessage): boolean {
  switch (msg.type) {
    case 'state:worksurface_result':
      return handleWorksurfaceResultFrame(msg as unknown as WorksurfaceResultFrame);
    case 'state:worksurface_error':
      return handleWorksurfaceErrorFrame(msg as unknown as WorksurfaceErrorFrame);
    case 'state:worksurface_changed': {
      const frame = msg as unknown as WorksurfaceChangedFrame;
      const activeWorkspaceId = usePanelStore.getState().activeWorkspaceId;
      // A fan-out for another workspace is never applied to this one.
      if (frame.workspaceId && frame.workspaceId !== activeWorkspaceId) return true;
      return handleWorksurfaceChangedFrame(frame);
    }
    default:
      return false;
  }
}
