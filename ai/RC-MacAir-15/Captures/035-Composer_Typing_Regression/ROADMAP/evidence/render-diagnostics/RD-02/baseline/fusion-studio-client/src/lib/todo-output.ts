/**
 * @module todo-output
 * @role Normalize todo tool arguments into a canonical TodoItem array.
 *        Handles multiple harness shapes and status synonyms.
 */

import type { TodoItem, TodoItemStatus } from '../types';

const STATUS_MAP: Record<string, TodoItemStatus> = {
  pending: 'pending',
  todo: 'pending',
  open: 'pending',
  in_progress: 'in_progress',
  'in-progress': 'in_progress',
  doing: 'in_progress',
  active: 'in_progress',
  completed: 'completed',
  complete: 'completed',
  done: 'completed',
  closed: 'completed',
};

function normalizeStatus(raw: unknown): TodoItemStatus {
  if (typeof raw === 'string') {
    const canonical = STATUS_MAP[raw.toLowerCase()];
    if (canonical) return canonical;
  }
  return 'pending';
}

function normalizePriority(raw: unknown): 'low' | 'medium' | 'high' | undefined {
  if (typeof raw !== 'string') return undefined;
  const p = raw.toLowerCase();
  if (p === 'low' || p === 'medium' || p === 'high') return p;
  return undefined;
}

function extractContent(item: Record<string, unknown>): string {
  const candidate = item.content ?? item.text ?? item.task ?? item.title;
  return typeof candidate === 'string' ? candidate : '';
}

function extractId(item: Record<string, unknown>, index: number): string {
  const candidate = item.id ?? item.key ?? item._id;
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : `todo-${index}`;
}

function isValidItem(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Parse todo tool arguments into a normalized array of TodoItem.
 *
 * Supports shapes:
 *   { todos: [...] }
 *   { items: [...] }
 *   { todo_list: [...] }
 *   [...]  (array directly)
 *
 * Each item may have content/text/task/title, status, and optional priority.
 * Returns empty array if no usable items are found.
 */
export function parseTodoArgs(args: Record<string, unknown> | undefined): TodoItem[] {
  if (!args) return [];
  return parseRawTodoList(args);
}

/**
 * Parse a toolDisplay array and extract todo items from the first
 * display object with type === 'todo'.
 *
 * The wire sends todo data in return_value.display as:
 *   [{ type: 'todo', items: [{ title: '...', status: '...' }] }]
 *
 * Returns empty array if no todo display object is found.
 */
export function parseTodoDisplay(display: unknown[] | undefined): TodoItem[] {
  if (!Array.isArray(display) || display.length === 0) return [];

  const todoDisplay = display.find(
    (d): d is Record<string, unknown> =>
      d !== null && typeof d === 'object' && (d as Record<string, unknown>).type === 'todo'
  );

  if (!todoDisplay) return [];

  const rawItems = todoDisplay.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return [];

  return parseRawTodoList(rawItems);
}

function parseRawTodoList(raw: unknown): TodoItem[] {
  if (!raw) return [];

  let rawList: unknown[] | undefined;

  if (Array.isArray(raw)) {
    rawList = raw as unknown[];
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.todos ?? obj.items ?? obj.todo_list;
    if (Array.isArray(candidate)) {
      rawList = candidate as unknown[];
    }
  }

  if (!rawList || rawList.length === 0) return [];

  const items: TodoItem[] = [];
  for (let i = 0; i < rawList.length; i++) {
    const raw = rawList[i];
    if (!isValidItem(raw)) continue;

    const content = extractContent(raw);
    if (!content.trim()) continue;

    items.push({
      id: extractId(raw, i),
      content: content.trim(),
      status: normalizeStatus(raw.status),
      priority: normalizePriority(raw.priority),
    });
  }

  return items;
}
