/**
 * write — compact file-change row with optional structured diff body.
 */

import { buildFileChangeTitle, formatFileChangeContent } from './shared/diff-display';
import type { ToolRenderer } from './types';

export const writeRenderer: ToolRenderer = {
  grouped: false,

  buildTitle: (_, args, segment) => buildFileChangeTitle('Write', args, segment),

  contentStyle: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontStyle: 'normal',
    fontSize: '13px',
  },

  showCursor: false,
  formatContent: (content, _args, segment) => formatFileChangeContent(content, segment),
};
