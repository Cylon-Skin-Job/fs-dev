/**
 * @module TodoDrawer
 * @role Per-thread todo list surface overlaid at the bottom of the chat stream.
 *        Two states only: collapsed ribbon (single row handle) and expanded
 *        (scrollable panel overlaying messages).
 */

import './TodoDrawer.css';
import { useCallback } from 'react';
import { usePanelStore } from '../../state/panelStore';
import { selectChatState } from './chatAreaConstants';
import type { TodoItem, TodoItemStatus } from '../../types';

interface TodoDrawerProps {
  threadId: string | null;
}

const STATUS_ORDER: Record<TodoItemStatus, number> = {
  in_progress: 0,
  pending: 1,
  completed: 2,
};

function sortItems(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

function getStatusIcon(status: TodoItemStatus): string {
  return status === 'completed' ? 'select_check_box' : 'check_box_outline_blank';
}

export function TodoDrawer({ threadId }: TodoDrawerProps) {
  const selector = selectChatState(threadId);
  const drawer = usePanelStore((state) => selector(state)?.todoDrawer);
  const setTodoDrawer = usePanelStore((state) => state.setTodoDrawer);

  const handleToggle = useCallback(() => {
    if (!drawer || !threadId) return;
    setTodoDrawer(threadId, { ...drawer, open: !drawer.open });
  }, [drawer, threadId, setTodoDrawer]);

  if (!drawer || drawer.items.length === 0) return null;

  const sorted = sortItems(drawer.items);
  const activeCount = drawer.items.filter((i) => i.status === 'in_progress').length;
  const totalCount = drawer.items.length;

  const containerClass = `rv-todo-drawer rv-todo-drawer--${drawer.open ? 'expanded' : 'collapsed'}`;
  const arrowIcon = drawer.open ? 'keyboard_arrow_down' : 'keyboard_arrow_up';

  return (
    <div className={containerClass}>
      {/* Handle / Header */}
      <button
        type="button"
        className="rv-todo-drawer-handle"
        onClick={handleToggle}
        aria-label={drawer.open ? 'Collapse todo drawer' : 'Expand todo drawer'}
      >
        <span className="rv-todo-drawer-title">Todo</span>
        <span className="rv-todo-drawer-count">
          {activeCount > 0 ? `${activeCount} active / ${totalCount} total` : `${totalCount} total`}
        </span>
        <span className="material-symbols-outlined rv-todo-drawer-arrow">
          {arrowIcon}
        </span>
      </button>

      {/* Task list */}
      {drawer.open && (
        <div className="rv-todo-drawer-list">
          {sorted.map((item) => (
            <div
              key={item.id}
              className={`rv-todo-drawer-item rv-todo-drawer-item--${item.status}`}
              title={item.content}
            >
              <span className="material-symbols-outlined rv-todo-drawer-item-icon">
                {getStatusIcon(item.status)}
              </span>
              <span className="rv-todo-drawer-item-text">{item.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
