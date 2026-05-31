/**
 * subagent — Agent output (singular).
 *
 * Line-by-line streaming, similar to thinking but not italic.
 */

import { buildSubagentTitle, formatSubagentContent } from '../subagent-output';
import type { ToolRenderer } from './types';

export const subagentRenderer: ToolRenderer = {
  grouped: false,
  buildTitle: (_itemCount, args) => buildSubagentTitle(args),
  contentStyle: {
    whiteSpace: 'normal',
    fontFamily: 'inherit',
    fontStyle: 'normal',
  },
  showCursor: true,
  formatContent: (content) => formatSubagentContent(content),
};
