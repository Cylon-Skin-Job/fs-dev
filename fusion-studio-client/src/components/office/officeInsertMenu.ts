/**
 * @module officeInsertMenu
 * @role Office-owned right-click insert menu for document body content.
 */
import { Crepe } from '@milkdown/crepe';
import { imageBlockSchema } from '@milkdown/kit/component/image-block';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import {
  addBlockTypeCommand,
  bulletListSchema,
  clearTextInCurrentBlockCommand,
  hrSchema,
  listItemSchema,
  orderedListSchema,
  paragraphSchema,
  wrapInBlockTypeCommand,
} from '@milkdown/kit/preset/commonmark';
import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  captureOfficeTableInsertionTarget,
  runOfficeTableInsertion,
  type OfficeTableInsertionCapture,
} from './officeTableInsertion';

const TABLE_GRID_ROWS = 8;
const TABLE_GRID_COLS = 8;
const TABLE_MIN_ROWS = 2;

type OfficeInsertAction = 'table' | 'image' | 'divider' | 'bullet-list' | 'ordered-list' | 'task-list';

export type OfficeInsertContextMenu = {
  hide: () => void;
  insertTable: (rows: number, columns: number) => boolean;
  cleanup: () => void;
};

function getTopLevelBlockAtPos(view: EditorView, pos: number) {
  const safePos = Math.max(0, Math.min(pos, view.state.doc.content.size));
  const $pos = view.state.doc.resolve(safePos);
  if ($pos.depth < 1) {
    const node = view.state.doc.nodeAt(safePos);
    return node ? { node, pos: safePos } : null;
  }
  return {
    node: $pos.node(1),
    pos: $pos.before(1),
  };
}

function prepareOfficeInsertPoint(ctx: Ctx, event: MouseEvent) {
  const view = ctx.get(editorViewCtx);
  const paragraph = paragraphSchema.type(ctx);
  const posAtCoords = view.posAtCoords({ left: event.clientX, top: event.clientY });
  const targetBlock = posAtCoords ? getTopLevelBlockAtPos(view, posAtCoords.pos) : null;

  view.focus();

  let tr = view.state.tr;
  let menuPos: number;

  if (targetBlock?.node.type === paragraph && targetBlock.node.textContent.trim().length === 0) {
    menuPos = targetBlock.pos + 1;
    if (targetBlock.node.content.size > 0) {
      tr = tr.delete(targetBlock.pos + 1, targetBlock.pos + 1 + targetBlock.node.content.size);
    }
  } else {
    const insertPos = targetBlock?.pos ?? view.state.doc.content.size;
    tr = tr.insert(insertPos, paragraph.create());
    menuPos = insertPos + 1;
  }

  tr = tr.setSelection(TextSelection.create(tr.doc, menuPos));
  view.dispatch(tr.scrollIntoView());
}

function runOfficeInsertAction(crepe: Crepe, action: Exclude<OfficeInsertAction, 'table'>) {
  crepe.editor.action((ctx) => {
    const commands = ctx.get(commandsCtx);
    const view = ctx.get(editorViewCtx);
    view.focus();

    switch (action) {
      case 'image':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(addBlockTypeCommand.key, {
          nodeType: imageBlockSchema.type(ctx),
        });
        break;
      case 'divider':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(addBlockTypeCommand.key, {
          nodeType: hrSchema.type(ctx),
        });
        break;
      case 'bullet-list':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: bulletListSchema.type(ctx),
        });
        break;
      case 'ordered-list':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: orderedListSchema.type(ctx),
        });
        break;
      case 'task-list':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(wrapInBlockTypeCommand.key, {
          nodeType: listItemSchema.type(ctx),
          attrs: { checked: false },
        });
        break;
    }
  });
}

function getOfficeTableMenuItem(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest('.rv-office-insert-context-item[data-office-insert="table"]') as HTMLElement | null;
}

export function installOfficeTableInsertGrid(
  insertTable: (rows: number, columns: number) => boolean,
  onAfterInsert: () => void,
) {
  let popover: HTMLDivElement | null = null;
  let hideTimer: ReturnType<typeof window.setTimeout> | null = null;
  let selectedRows = TABLE_MIN_ROWS;
  let selectedCols = 2;

  const clearHideTimer = () => {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = null;
  };

  const hide = () => {
    clearHideTimer();
    popover?.remove();
    popover = null;
  };

  const updateGrid = (rows: number, cols: number) => {
    selectedRows = Math.max(TABLE_MIN_ROWS, rows);
    selectedCols = Math.max(1, cols);
    if (!popover) return;

    popover.querySelectorAll<HTMLButtonElement>('.rv-office-table-grid-cell').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      cell.dataset.active = row <= selectedRows && col <= selectedCols ? 'true' : 'false';
    });
    const label = popover.querySelector<HTMLElement>('.rv-office-table-grid-label');
    if (label) label.textContent = `${selectedRows} x ${selectedCols}`;
  };

  const positionPopover = (anchor: HTMLElement) => {
    if (!popover) return;
    const rect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const left = Math.min(rect.right + 8, window.innerWidth - popoverRect.width - 8);
    const top = Math.min(rect.top, window.innerHeight - popoverRect.height - 8);
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.top = `${Math.max(8, top)}px`;
  };

  const insertSelectedTable = () => {
    if (insertTable(selectedRows, selectedCols)) onAfterInsert();
    hide();
  };

  const show = (anchor: HTMLElement) => {
    clearHideTimer();
    if (!popover) {
      popover = document.createElement('div');
      popover.className = 'rv-office-table-grid-popover';
      popover.addEventListener('pointerenter', clearHideTimer);
      popover.addEventListener('pointerleave', () => {
        hideTimer = window.setTimeout(hide, 120);
      });
      popover.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      const grid = document.createElement('div');
      grid.className = 'rv-office-table-grid-cells';
      for (let row = 1; row <= TABLE_GRID_ROWS; row += 1) {
        for (let col = 1; col <= TABLE_GRID_COLS; col += 1) {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'rv-office-table-grid-cell';
          cell.dataset.row = String(row);
          cell.dataset.col = String(col);
          cell.setAttribute('aria-label', `${Math.max(TABLE_MIN_ROWS, row)} by ${col} table`);
          cell.addEventListener('pointerenter', () => updateGrid(row, col));
          cell.addEventListener('pointerup', (event) => {
            event.preventDefault();
            event.stopPropagation();
            insertSelectedTable();
          });
          grid.appendChild(cell);
        }
      }

      const label = document.createElement('div');
      label.className = 'rv-office-table-grid-label';
      popover.append(grid, label);
      document.body.appendChild(popover);
      updateGrid(selectedRows, selectedCols);
    }

    positionPopover(anchor);
  };

  const scheduleHide = () => {
    clearHideTimer();
    hideTimer = window.setTimeout(hide, 120);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (popover?.contains(event.target as Node)) return;
    const tableItem = getOfficeTableMenuItem(event.target);
    if (tableItem) {
      show(tableItem);
      return;
    }
    if (popover && !(event.target instanceof Element && event.target.closest('.rv-office-insert-context-menu'))) {
      scheduleHide();
    }
  };

  const onWindowPointerDown = (event: PointerEvent) => {
    if (popover?.contains(event.target as Node)) return;
    hide();
  };

  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerdown', onWindowPointerDown, true);

  return () => {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerdown', onWindowPointerDown, true);
    hide();
  };
}

function createOfficeInsertContextItem(
  action: OfficeInsertAction,
  label: string,
  icon: string,
  onRun: () => void,
) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'rv-office-insert-context-item';
  item.dataset.officeInsert = action;
  item.innerHTML = [
    `<span class="material-symbols-outlined">${icon}</span>`,
    `<span>${label}</span>`,
  ].join('');
  item.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRun();
  });
  return item;
}

export function installOfficeInsertContextMenu(root: HTMLElement, crepe: Crepe): OfficeInsertContextMenu {
  let menu: HTMLDivElement | null = null;
  let pendingTableCapture: OfficeTableInsertionCapture | null = null;
  let pendingInvocation: MouseEvent | null = null;

  const hide = () => {
    menu?.remove();
    menu = null;
  };

  const positionMenu = (clientX: number, clientY: number) => {
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const left = Math.min(clientX, window.innerWidth - rect.width - 8);
    const top = Math.min(clientY, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.max(8, left)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
  };

  const appendDivider = () => {
    if (!menu) return;
    const divider = document.createElement('div');
    divider.className = 'rv-office-insert-context-divider';
    menu.appendChild(divider);
  };

  const appendAction = (action: OfficeInsertAction, label: string, icon: string) => {
    if (!menu) return;
    menu.appendChild(createOfficeInsertContextItem(action, label, icon, () => {
      if (action === 'table') {
        insertTable(TABLE_MIN_ROWS, 2);
      } else if (pendingInvocation) {
        const invocation = pendingInvocation;
        crepe.editor.action((ctx) => prepareOfficeInsertPoint(ctx, invocation));
        runOfficeInsertAction(crepe, action);
      }
      hide();
    }));
  };

  const insertTable = (rows: number, columns: number) => {
    const capture = pendingTableCapture;
    if (!capture) return false;
    let inserted = false;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.focus();
      const result = runOfficeTableInsertion({
        root,
        view,
        commands: ctx.get(commandsCtx),
        capture,
        rows,
        columns,
      });
      inserted = result.applied;
    });
    pendingTableCapture = null;
    pendingInvocation = null;
    return inserted;
  };

  const show = (clientX: number, clientY: number) => {
    hide();
    menu = document.createElement('div');
    menu.className = 'rv-office-insert-context-menu';
    menu.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    appendAction('table', 'Table', 'table_chart');
    appendAction('image', 'Image', 'image');
    appendAction('divider', 'Divider', 'horizontal_rule');
    appendDivider();
    appendAction('bullet-list', 'Bullet List', 'format_list_bulleted');
    appendAction('ordered-list', 'Ordered List', 'format_list_numbered');
    appendAction('task-list', 'Check List', 'checklist');

    document.body.appendChild(menu);
    positionMenu(clientX, clientY);
  };

  const onContextMenu = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest('.milkdown-table-block td, .milkdown-table-block th')) return;
    if (!event.target.closest('.ProseMirror, .rv-office-document-editor')) return;

    event.preventDefault();
    event.stopPropagation();
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const posAtCoords = view.posAtCoords({ left: event.clientX, top: event.clientY });
      const targetBlock = posAtCoords ? getTopLevelBlockAtPos(view, posAtCoords.pos) : null;
      pendingTableCapture = captureOfficeTableInsertionTarget(
        view.state,
        targetBlock?.pos ?? null,
      );
      pendingInvocation = event;
      show(event.clientX, event.clientY);
    });
  };

  const onWindowPointerDown = (event: PointerEvent) => {
    if (menu?.contains(event.target as Node)) return;
    hide();
  };

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') hide();
  };

  root.addEventListener('contextmenu', onContextMenu, true);
  window.addEventListener('pointerdown', onWindowPointerDown, true);
  window.addEventListener('keydown', onWindowKeyDown, true);

  return {
    hide,
    insertTable,
    cleanup: () => {
      root.removeEventListener('contextmenu', onContextMenu, true);
      window.removeEventListener('pointerdown', onWindowPointerDown, true);
      window.removeEventListener('keydown', onWindowKeyDown, true);
      pendingTableCapture = null;
      pendingInvocation = null;
      hide();
    },
  };
}
