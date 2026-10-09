import type { SegmentType } from '../types';

const SEGMENT_ICONS: Record<string, { icon: string; label: string }> = {
  think:      { icon: 'lightbulb',      label: 'Thinking' },
  shell:      { icon: 'terminal',       label: 'Shell' },
  read:       { icon: 'description',    label: 'Read' },
  write:      { icon: 'edit_note',      label: 'Write' },
  edit:       { icon: 'edit_note',      label: 'Edit' },
  glob:       { icon: 'map_search',      label: 'Globs' },
  grep:       { icon: 'document_search', label: 'Grep' },
  web_search: { icon: 'travel_explore', label: 'Web Search' },
  fetch:      { icon: 'link_2',         label: 'Fetch-URL' },
  subagent:   { icon: 'smart_toy',      label: 'Subagent' },
  todo:       { icon: 'list_alt_check', label: 'Update ToDo List' },
};

const CANONICAL_TOOL_SEGMENTS: Record<string, SegmentType> = {
  shell: 'shell',
  read: 'read',
  write: 'write',
  edit: 'edit',
  glob: 'glob',
  grep: 'grep',
  web_search: 'web_search',
  fetch: 'fetch',
  subagent: 'subagent',
  todo: 'todo',
};

/** Map canonical tool name to our segment type */
export function toolNameToSegmentType(toolName: string): SegmentType {
  const segType = CANONICAL_TOOL_SEGMENTS[toolName];
  if (segType) return segType;
  console.warn(`[toolNameToSegmentType] Unknown canonical tool name: "${toolName}"`);
  return 'read';
}

export { SEGMENT_ICONS };
