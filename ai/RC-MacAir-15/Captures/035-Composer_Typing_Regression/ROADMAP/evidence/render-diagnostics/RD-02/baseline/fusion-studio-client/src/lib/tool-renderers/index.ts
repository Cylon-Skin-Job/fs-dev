/**
 * Tool Renderer Registry — maps segment type to its presentation module.
 *
 * Every tool type has exactly one renderer. LiveToolSegment and
 * InstantToolBlock call getToolRenderer() and use the returned
 * module for ALL presentation decisions. Zero type-specific code
 * in the components.
 */

import type { SegmentType } from '../../types';
import type { ToolRenderer } from './types';
import { thinkRenderer } from './think';
import { shellRenderer } from './shell';
import { readRenderer } from './read';
import { globRenderer } from './glob';
import { grepRenderer } from './grep';
import { writeRenderer } from './write';
import { editRenderer } from './edit';
import { webSearchRenderer } from './web-search';
import { fetchRenderer } from './fetch';
import { subagentRenderer } from './subagent';
import { todoRenderer } from './todo';
import { reportUnknownToolType } from './unknown-tool-reporter';
import { withUniversalToolErrorPresentation } from './shared/error-display';

const BASE_REGISTRY: Record<string, ToolRenderer> = {
  think: thinkRenderer,
  shell: shellRenderer,
  read: readRenderer,
  glob: globRenderer,
  grep: grepRenderer,
  write: writeRenderer,
  edit: editRenderer,
  web_search: webSearchRenderer,
  fetch: fetchRenderer,
  subagent: subagentRenderer,
  todo: todoRenderer,
};

const REGISTRY: Record<string, ToolRenderer> = Object.fromEntries(
  Object.entries(BASE_REGISTRY).map(([type, renderer]) => [
    type,
    withUniversalToolErrorPresentation(type, renderer),
  ]),
) as Record<string, ToolRenderer>;

/** Unknown segment types render plainly, but loudly. */
const fallbackRenderer: ToolRenderer = withUniversalToolErrorPresentation('unknown', {
  grouped: false,
  buildTitle: () => 'Unknown tool',
  contentStyle: {
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontStyle: 'normal',
    fontSize: '13px',
  },
  formatContent: (content) => content,
});

export function getToolRenderer(type: SegmentType | string): ToolRenderer {
  const renderer = REGISTRY[type];
  if (renderer) return renderer;
  reportUnknownToolType(type);
  return fallbackRenderer;
}

export type { ToolRenderer, ContentStyle } from './types';
