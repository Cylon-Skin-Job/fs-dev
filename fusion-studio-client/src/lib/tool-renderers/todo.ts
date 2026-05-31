/**
 * todo — Inline marker only. The actionable checklist lives in TodoDrawer.
 *
 * formatContent returns '' so ToolCallBlock renders no dropdown arrow
 * and no body, keeping the transcript compact.
 */

import type { ToolRenderer } from './types';

export const todoRenderer: ToolRenderer = {
  grouped: false,
  buildTitle: () => 'Update ToDo List',
  contentStyle: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'inherit',
    fontStyle: 'normal',
  },
  showCursor: false,
  formatContent: () => '',
};
