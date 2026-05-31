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

/** Map wire tool name to our segment type */
export function toolNameToSegmentType(toolName: string): SegmentType {
  const map: Record<string, SegmentType> = {
    Shell: 'shell',
    ReadFile: 'read',
    WriteFile: 'write',
    EditFile: 'edit',
    StrReplaceFile: 'edit',
    Glob: 'glob',
    Grep: 'grep',
    SearchWeb: 'web_search',
    FetchURL: 'fetch',
    Agent: 'subagent',
    Task: 'subagent',
    SetTodoList: 'todo',
    TodoWrite: 'todo',
  };
  return map[toolName] || 'read';
}

export { SEGMENT_ICONS };
