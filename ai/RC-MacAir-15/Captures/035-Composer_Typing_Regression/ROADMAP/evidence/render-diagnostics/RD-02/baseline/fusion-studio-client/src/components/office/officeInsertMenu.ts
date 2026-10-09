/**
 * @module officeInsertMenu
 * @role Capture Office insert targets, compose shared-menu descriptors, and run insert commands.
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
  openMenuTree,
  type MenuDescriptor,
  type MenuExternalChildContext,
  type MenuExternalRegistration,
  type MenuHandle,
} from '../menu';
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
  cleanup: () => void;
};

function getTopLevelBlockAtPos(view: EditorView, pos: number) {
  const safePos = Math.max(0, Math.min(pos, view.state.doc.content.size));
  const $pos = view.state.doc.resolve(safePos);
  if ($pos.depth < 1) {
    const node = view.state.doc.nodeAt(safePos);
    return node ? { node, pos: safePos } : null;
  }
  return { node: $pos.node(1), pos: $pos.before(1) };
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
        commands.call(addBlockTypeCommand.key, { nodeType: imageBlockSchema.type(ctx) });
        break;
      case 'divider':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(addBlockTypeCommand.key, { nodeType: hrSchema.type(ctx) });
        break;
      case 'bullet-list':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(wrapInBlockTypeCommand.key, { nodeType: bulletListSchema.type(ctx) });
        break;
      case 'ordered-list':
        commands.call(clearTextInCurrentBlockCommand.key);
        commands.call(wrapInBlockTypeCommand.key, { nodeType: orderedListSchema.type(ctx) });
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

interface OfficeTableInsertGridController {
  open: (context: MenuExternalChildContext) => void;
  hide: () => void;
  cleanup: () => void;
}

export function installOfficeTableInsertGrid(
  insertTable: (rows: number, columns: number) => boolean,
): OfficeTableInsertGridController {
  let popover: HTMLDivElement | null = null;
  let anchor: HTMLElement | null = null;
  let registration: MenuExternalRegistration | null = null;
  let hideTimer: ReturnType<typeof window.setTimeout> | null = null;
  let selectedRows = TABLE_MIN_ROWS;
  let selectedCols = 2;

  const clearHideTimer = () => {
    if (!hideTimer) return;
    window.clearTimeout(hideTimer);
    hideTimer = null;
  };

  const removePopover = (unregister: boolean) => {
    clearHideTimer();
    if (unregister) registration?.unregister();
    registration = null;
    popover?.remove();
    popover = null;
    anchor = null;
  };

  const hide = () => removePopover(true);
  const teardown = () => removePopover(false);

  const updateGrid = (rows: number, cols: number) => {
    selectedRows = Math.max(TABLE_MIN_ROWS, rows);
    selectedCols = Math.max(1, cols);
    popover?.querySelectorAll<HTMLButtonElement>('.rv-office-table-grid-cell').forEach((cell) => {
      const row = Number(cell.dataset.row);
      const col = Number(cell.dataset.col);
      cell.dataset.active = row <= selectedRows && col <= selectedCols ? 'true' : 'false';
    });
    const label = popover?.querySelector<HTMLElement>('.rv-office-table-grid-label');
    if (label) label.textContent = `${selectedRows} x ${selectedCols}`;
  };

  const position = (ownerElement?: HTMLButtonElement) => {
    if (ownerElement) anchor = ownerElement;
    if (!popover || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const fitsRight = rect.right + 8 + popoverRect.width <= window.innerWidth - 8;
    const left = fitsRight ? rect.right + 8 : rect.left - popoverRect.width - 8;
    const top = Math.min(rect.top, window.innerHeight - popoverRect.height - 8);
    popover.style.left = `${Math.max(8, left)}px`;
    popover.style.top = `${Math.max(8, top)}px`;
  };

  const insertSelectedTable = () => {
    const activeRegistration = registration;
    if (insertTable(selectedRows, selectedCols)) activeRegistration?.closeTree('action');
    else hide();
  };

  const open = (context: MenuExternalChildContext) => {
    clearHideTimer();
    if (registration?.isActive()) return;
    teardown();
    anchor = context.anchorElement;
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
    position();
    registration = context.registerSurface(popover, {
      teardown,
      reposition: position,
      onOwnerReenter: clearHideTimer,
    });
    if (!registration) teardown();
  };

  return { open, hide, cleanup: hide };
}

function restoreEditorInvocation(view: EditorView, selection: EditorView['state']['selection']) {
  view.focus();
  if (!view.state.selection.eq(selection)) view.dispatch(view.state.tr.setSelection(selection));
}

export function installOfficeInsertContextMenu(root: HTMLElement, crepe: Crepe): OfficeInsertContextMenu {
  let menu: MenuHandle | null = null;
  let pendingTableCapture: OfficeTableInsertionCapture | null = null;
  let pendingInvocation: MouseEvent | null = null;

  const insertTable = (rows: number, columns: number) => {
    const capture = pendingTableCapture;
    if (!capture) return false;
    let inserted = false;
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      view.focus();
      inserted = runOfficeTableInsertion({
        root, view, commands: ctx.get(commandsCtx), capture, rows, columns,
      }).applied;
    });
    pendingTableCapture = null;
    pendingInvocation = null;
    return inserted;
  };

  const grid = installOfficeTableInsertGrid(insertTable);

  const hide = () => {
    menu?.close('programmatic');
    menu = null;
    grid.hide();
  };

  const runAction = (action: Exclude<OfficeInsertAction, 'table'>) => {
    if (pendingInvocation) {
      const invocation = pendingInvocation;
      crepe.editor.action((ctx) => prepareOfficeInsertPoint(ctx, invocation));
      runOfficeInsertAction(crepe, action);
    }
    return { kind: 'close-all' } as const;
  };

  const descriptors = (): readonly MenuDescriptor[] => [
    {
      kind: 'external-child', id: 'insert-table', label: 'Table', icon: 'table_chart', openOn: 'hover',
      onOpen: grid.open,
      onSelect: () => {
        insertTable(TABLE_MIN_ROWS, 2);
        return { kind: 'close-all' };
      },
    },
    { kind: 'action', id: 'insert-image', label: 'Image', icon: 'image', onSelect: () => runAction('image') },
    { kind: 'action', id: 'insert-divider', label: 'Divider', icon: 'horizontal_rule', onSelect: () => runAction('divider') },
    { kind: 'separator', id: 'insert-separator-lists' },
    { kind: 'action', id: 'insert-bullet-list', label: 'Bullet List', icon: 'format_list_bulleted', onSelect: () => runAction('bullet-list') },
    { kind: 'action', id: 'insert-ordered-list', label: 'Ordered List', icon: 'format_list_numbered', onSelect: () => runAction('ordered-list') },
    { kind: 'action', id: 'insert-task-list', label: 'Check List', icon: 'checklist', onSelect: () => runAction('task-list') },
  ];

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
      pendingTableCapture = captureOfficeTableInsertionTarget(view.state, targetBlock?.pos ?? null);
      pendingInvocation = event;
      const invocationSelection = view.state.selection;
      menu?.close('replaced');
      menu = openMenuTree({
        anchor: { kind: 'pointer', clientX: event.clientX, clientY: event.clientY },
        items: descriptors(),
        ariaLabel: 'Insert content',
        minWidth: 184,
        restoreInvocationFocus: () => restoreEditorInvocation(view, invocationSelection),
        focusAfterAction: () => view.focus(),
        onActionError: (error) => console.error('[OfficeInsert] action failed', error),
        onClose: () => { menu = null; grid.hide(); },
      });
    });
  };

  root.addEventListener('contextmenu', onContextMenu, true);
  return {
    hide,
    cleanup: () => {
      root.removeEventListener('contextmenu', onContextMenu, true);
      pendingTableCapture = null;
      pendingInvocation = null;
      hide();
      grid.cleanup();
    },
  };
}
