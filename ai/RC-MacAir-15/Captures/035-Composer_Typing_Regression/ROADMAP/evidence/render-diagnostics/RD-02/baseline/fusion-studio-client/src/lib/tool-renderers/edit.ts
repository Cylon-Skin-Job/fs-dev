/**
 * edit — compact file-change row with optional structured diff body.
 */

import { buildFileChangeTitle, formatFileChangeContent } from './shared/diff-display';
import type { ToolRenderer } from './types';

export const editRenderer: ToolRenderer = {
  grouped: false,

  buildTitle: (_, args, segment) => buildFileChangeTitle('Edit', args, segment),

  contentStyle: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontStyle: 'normal',
    fontSize: '13px',
  },

  formatContent: (content, _args, segment) => formatFileChangeContent(content, segment),
};
