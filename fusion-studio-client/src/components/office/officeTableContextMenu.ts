/**
 * @module officeTableContextMenu
 * @role Office-owned right-click menu for table row and column operations.
 */
import { Crepe } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
import { findParent } from '@milkdown/kit/prose';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  selectColCommand,
  selectRowCommand,
} from '@milkdown/kit/preset/gfm';
import { TableMap } from '@milkdown/kit/prose/tables';
import {
  DOCUMENT_TABLE_BORDER_WIDTHS,
  type DocumentTableAlignment,
  type DocumentTableOverflow,
} from '../../lib/front-matter';
import type {
  OfficeTableColorAction,
  OfficeTableColorActionTarget,
  OfficeTableColorsController,
} from './officeTableColors';
import type {
  OfficeTableBorderActionTarget,
  OfficeTableBorderState,
  OfficeTableAlignmentActionTarget,
  OfficeTableDisplayController,
  OfficeTableOverflowActionTarget,
} from './officeTableDisplay';
import type { ColorPopoverController } from './officeColorPopover';
import {
  runCertifiedStockOfficeTableMutation,
  runOfficeTableTitleRowMutation,
  type OfficeTableStructureMutation,
} from './officeTableMutations';
import { getVerifiedOfficeTableTitleWidth } from './officeTableTitleCodec';
import {
  createOfficeTableMetadataPlugin,
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataSnapshot,
} from './officeTableHistory';
import {
  captureOfficeTableRemovalTarget,
  type OfficeTableRemovalCapture,
} from './officeTableRemoval';

export type OfficeTableAction =
  | 'insert-row-above'
  | 'insert-row-below'
  | 'insert-col-left'
  | 'insert-col-right'
  | 'delete-row-above'
  | 'delete-row-below'
  | 'delete-col-left'
  | 'delete-col-right';

export type OfficeTableContext = {
  rowIndex: number;
  rowEndIndex: number;
  colIndex: number;
  colEndIndex: number;
  rowCount: number;
  colCount: number;
  tablePos: number;
  topRowCellCount?: number;
  verifiedTitleTable?: boolean;
  verifiedTitleContext?: boolean;
};

export const OFFICE_TABLE_REMOVE_REQUEST_EVENT = 'rv-office-table-remove-request';

const OFFICE_TABLE_OVERFLOW_CHOICES: ReadonlyArray<{
  label: string;
  value: DocumentTableOverflow;
}> = [
  { label: 'Overflow', value: 'overflow' },
  { label: 'Truncate', value: 'truncate' },
  { label: 'New line', value: 'newline' },
];

const OFFICE_TABLE_ALIGNMENT_CHOICES: ReadonlyArray<{
  label: string;
  icon: string;
  value: DocumentTableAlignment;
}> = [
  { label: 'Align table left', icon: 'align_horizontal_left', value: 'left' },
  { label: 'Align table center', icon: 'align_horizontal_center', value: 'center' },
  { label: 'Align table right', icon: 'align_horizontal_right', value: 'right' },
];

export type OfficeTableRemoveRequest = {
  context: OfficeTableContext;
  capture: OfficeTableRemovalCapture;
  restoreEditorFocus: () => void;
};

export function getLogicalTableCellContext(table: ProseNode, cell: ProseNode) {
  const tableMap = TableMap.get(table);
  const cellPosition = [...new Set(tableMap.map)].find((position) => table.nodeAt(position) === cell);
  if (cellPosition === undefined) return null;
  const rect = tableMap.findCell(cellPosition);
  return {
    rowIndex: rect.top,
    rowEndIndex: rect.bottom,
    colIndex: rect.left,
    colEndIndex: rect.right,
  };
}

function getOfficeTableContext(view: EditorView, clientX: number, clientY: number): OfficeTableContext | null {
  try {
    const posAtCoords = view.posAtCoords({ left: clientX, top: clientY });
    const pos = posAtCoords?.inside != null && posAtCoords.inside >= 0
      ? posAtCoords.inside
      : posAtCoords?.pos;
    if (pos == null || pos < 0) return null;

    const $pos = view.state.doc.resolve(pos);
    const node = view.state.doc.nodeAt(pos);
    const isCell = (candidate: ProseNode) => (
      candidate.type.name === 'table_cell' || candidate.type.name === 'table_header'
    );
    const cell = node && isCell(node) ? { node } : findParent(isCell)($pos);
    const table = findParent((candidate) => candidate.type.name === 'table')($pos);
    if (!cell || !table) return null;

    const tableMap = TableMap.get(table.node);
    const logical = getLogicalTableCellContext(table.node, cell.node);
    if (!logical) return null;
    const verifiedTitleWidth = getVerifiedOfficeTableTitleWidth(table.node);
    return {
      rowIndex: logical.rowIndex,
      rowEndIndex: logical.rowEndIndex,
      colIndex: logical.colIndex,
      colEndIndex: logical.colEndIndex,
      rowCount: tableMap.height,
      colCount: tableMap.width,
      tablePos: table.from + 1,
      topRowCellCount: table.node.child(0).childCount,
      verifiedTitleTable: verifiedTitleWidth === tableMap.width,
      verifiedTitleContext: logical.rowIndex === 0 && verifiedTitleWidth === tableMap.width,
    };
  } catch {
    return null;
  }
}

export function isOfficeTableMutationForbiddenForVerifiedTitle(
  context: OfficeTableContext,
  mutation: OfficeTableStructureMutation,
): boolean {
  if (!context.verifiedTitleTable || mutation.axis !== 'row' || mutation.action !== 'delete') {
    return false;
  }
  return mutation.index === 0 || context.rowCount <= 3;
}

export function getOfficeTableMutationForAction(
  context: OfficeTableContext,
  action: OfficeTableAction,
): OfficeTableStructureMutation | null {
  switch (action) {
    case 'insert-row-above':
      return { axis: 'row', action: 'insert', index: context.rowIndex };
    case 'insert-row-below':
      return { axis: 'row', action: 'insert', index: context.rowEndIndex };
    case 'insert-col-left':
      return {
        axis: 'column', action: 'insert', index: context.colIndex, anchorIndex: context.colIndex,
      };
    case 'insert-col-right':
      return {
        axis: 'column', action: 'insert', index: context.colEndIndex, anchorIndex: context.colEndIndex - 1,
      };
    case 'delete-row-above':
      return context.rowIndex > 0 ? { axis: 'row', action: 'delete', index: context.rowIndex - 1 } : null;
    case 'delete-row-below':
      return context.rowEndIndex < context.rowCount
        ? { axis: 'row', action: 'delete', index: context.rowEndIndex }
        : null;
    case 'delete-col-left':
      return context.colIndex > 0 && context.colCount > 1
        ? { axis: 'column', action: 'delete', index: context.colIndex - 1 }
        : null;
    case 'delete-col-right':
      return context.colEndIndex < context.colCount && context.colCount > 1
        ? { axis: 'column', action: 'delete', index: context.colEndIndex }
        : null;
  }
}

const MINIMUM_ROWS_REASON = 'A table must keep one schema header row and at least one data row.';
const MINIMUM_COLUMNS_REASON = 'A table must keep at least one column.';
const NO_ROW_ABOVE_REASON = 'There is no adjacent row above this cell to delete.';
const NO_ROW_BELOW_REASON = 'There is no adjacent row below this cell to delete.';
const NO_COLUMN_LEFT_REASON = 'There is no adjacent column to the left of this cell to delete.';
const NO_COLUMN_RIGHT_REASON = 'There is no adjacent column to the right of this cell to delete.';

export function getOfficeTableActionDisabledReason(
  context: OfficeTableContext,
  action: OfficeTableAction,
): string | undefined {
  switch (action) {
    case 'delete-row-above':
      return context.rowCount <= 2
        ? MINIMUM_ROWS_REASON
        : context.rowIndex <= 0 ? NO_ROW_ABOVE_REASON : undefined;
    case 'delete-row-below':
      return context.rowCount <= 2
        ? MINIMUM_ROWS_REASON
        : context.rowEndIndex >= context.rowCount ? NO_ROW_BELOW_REASON : undefined;
    case 'delete-col-left':
      return context.colCount <= 1
        ? MINIMUM_COLUMNS_REASON
        : context.colIndex <= 0 ? NO_COLUMN_LEFT_REASON : undefined;
    case 'delete-col-right':
      return context.colCount <= 1
        ? MINIMUM_COLUMNS_REASON
        : context.colEndIndex >= context.colCount ? NO_COLUMN_RIGHT_REASON : undefined;
    default:
      return undefined;
  }
}

function runOfficeTableAction(
  root: HTMLElement,
  crepe: Crepe,
  context: OfficeTableContext,
  action: OfficeTableAction,
): boolean {
  if (context.verifiedTitleContext && [
    'insert-row-above',
    'delete-row-above',
    'insert-col-left',
    'insert-col-right',
    'delete-col-left',
    'delete-col-right',
  ].includes(action)) return false;
  let didRun = false;
  crepe.editor.action((ctx) => {
    const commands = ctx.get(commandsCtx);
    const view = ctx.get(editorViewCtx);
    const mutation = getOfficeTableMutationForAction(context, action);
    if (!mutation || isOfficeTableMutationForbiddenForVerifiedTitle(context, mutation)) return;
    view.focus();
    const rowAction = mutation.axis === 'row';
    const selectionIndex = mutation.action === 'delete'
      ? mutation.index
      : (rowAction ? context.rowIndex : context.colIndex);
    const mutationCommandKey = action === 'insert-row-above'
      ? addRowBeforeCommand.key
      : action === 'insert-row-below'
        ? addRowAfterCommand.key
        : action === 'insert-col-left'
          ? addColBeforeCommand.key
          : action === 'insert-col-right'
            ? addColAfterCommand.key
            : deleteSelectedCellsCommand.key;
    const result = runCertifiedStockOfficeTableMutation({
      root,
      view,
      commands,
      tablePos: context.tablePos,
      selectionIndex,
      mutation,
      selectionCommandKey: rowAction ? selectRowCommand.key : selectColCommand.key,
      mutationCommandKey,
    });
    didRun = result.applied;
    if (!result.applied) {
      console.error(`[OfficeTable] ${action} rejected: ${result.reason}`);
    }
  });
  return didRun;
}

function runOfficeTableTitleAction(
  root: HTMLElement,
  crepe: Crepe,
  context: OfficeTableContext,
  action: 'add' | 'delete',
): boolean {
  if ((action === 'add' && context.topRowCellCount === 1)
    || (action === 'delete' && (!context.verifiedTitleContext || context.rowCount < 3))) return false;
  let didRun = false;
  crepe.editor.action((ctx) => {
    const commands = ctx.get(commandsCtx);
    const view = ctx.get(editorViewCtx);
    view.focus();
    const result = runOfficeTableTitleRowMutation({
      root,
      view,
      commands,
      tablePos: context.tablePos,
      action,
    });
    didRun = result.applied;
    if (!result.applied) console.error(`[OfficeTable] ${action} title row rejected: ${result.reason}`);
  });
  return didRun;
}

export function createOfficeTableContextItem(
  label: string,
  icon: string,
  onRun: () => void,
  disabled = false,
  disabledReason?: string,
  submenu = false,
) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'rv-office-table-context-item';
  item.setAttribute('role', 'menuitem');
  item.tabIndex = -1;
  item.disabled = disabled;
  if (disabled) {
    item.setAttribute('aria-disabled', 'true');
    if (disabledReason) {
      item.title = disabledReason;
      item.setAttribute('aria-label', `${label}: ${disabledReason}`);
    }
  }
  const iconElement = document.createElement('span');
  iconElement.className = 'material-symbols-outlined';
  iconElement.setAttribute('aria-hidden', 'true');
  iconElement.textContent = icon;
  const labelElement = document.createElement('span');
  labelElement.textContent = label;
  item.append(iconElement, labelElement);
  if (submenu) {
    item.classList.add('rv-office-table-context-submenu-trigger');
    item.setAttribute('aria-haspopup', 'menu');
    item.setAttribute('aria-expanded', 'false');
    const chevron = document.createElement('span');
    chevron.className = 'material-symbols-outlined rv-office-table-context-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = 'chevron_right';
    item.appendChild(chevron);
  }
  item.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  item.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled) onRun();
  });
  return item;
}

function createOfficeTableRadioChoice(
  label: string,
  checked: boolean,
  onRun: () => void,
) {
  const item = createOfficeTableContextItem(label, checked ? 'check' : '', onRun);
  item.classList.add('rv-office-table-context-radio');
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', String(checked));
  return item;
}

function createOfficeTableAlignmentChoice(
  label: string,
  icon: string,
  checked: boolean,
  onRun: () => void,
) {
  const item = createOfficeTableContextItem(label, icon, onRun);
  item.classList.add('rv-office-table-context-radio', 'rv-office-table-context-alignment');
  item.setAttribute('role', 'menuitemradio');
  item.setAttribute('aria-checked', String(checked));
  const check = document.createElement('span');
  check.className = 'material-symbols-outlined rv-office-table-context-radio-check';
  check.setAttribute('aria-hidden', 'true');
  check.textContent = checked ? 'check' : '';
  item.appendChild(check);
  return item;
}

function menuItems(menu: HTMLElement) {
  return Array.from(menu.children).filter((element): element is HTMLButtonElement => (
    element instanceof HTMLButtonElement
      && element.matches('.rv-office-table-context-item:not(:disabled)')
  ));
}

function focusMenuItem(menu: HTMLElement, direction: 1 | -1) {
  const items = menuItems(menu);
  if (items.length === 0) return;
  const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex = activeIndex < 0
    ? (direction === 1 ? 0 : items.length - 1)
    : (activeIndex + direction + items.length) % items.length;
  items[nextIndex]?.focus({ preventScroll: true });
}

function clampMenuToViewport(menu: HTMLElement, preferredLeft: number, preferredTop: number) {
  const margin = 8;
  const rect = menu.getBoundingClientRect();
  const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
  const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
  menu.style.left = `${Math.min(Math.max(margin, preferredLeft), maxLeft)}px`;
  menu.style.top = `${Math.min(Math.max(margin, preferredTop), maxTop)}px`;
}

export function installOfficeTableContextMenu(
  root: HTMLElement,
  crepe: Crepe,
  colors: OfficeTableColorsController,
  display: OfficeTableDisplayController,
  popover: ColorPopoverController,
  onMetadataSnapshot: (
    snapshot: OfficeTableMetadataSnapshot,
    before: OfficeTableMetadataSnapshot,
    document: ProseNode | undefined,
    token: number,
  ) => boolean,
  onPrepareDeferredSnapshot?: (token: number, document?: ProseNode) => boolean,
  onCancelDeferredSnapshot?: (token: number, document?: ProseNode) => boolean,
  onIsCurrentSnapshot?: (token: number) => boolean,
) {
  crepe.editor.use(createOfficeTableMetadataPlugin(root));
  const unregisterMetadataSnapshot = registerOfficeTableMetadataBindings(root, {
    publishSnapshot: onMetadataSnapshot,
    prepareDeferredSnapshot: onPrepareDeferredSnapshot,
    cancelDeferredSnapshot: onCancelDeferredSnapshot,
    isCurrentSnapshot: onIsCurrentSnapshot,
  });
  let menu: HTMLDivElement | null = null;
  let submenu: HTMLDivElement | null = null;
  let nestedSubmenu: HTMLDivElement | null = null;
  let tableTrigger: HTMLButtonElement | null = null;
  let borderSizeTrigger: HTMLButtonElement | null = null;
  let overflowTrigger: HTMLButtonElement | null = null;
  let nestedSubmenuTrigger: HTMLButtonElement | null = null;
  let invokingView: EditorView | null = null;
  let activeContext: OfficeTableContext | null = null;
  let activeRemovalCapture: OfficeTableRemovalCapture | null = null;
  let activeOverflowTarget: OfficeTableOverflowActionTarget | null = null;
  let activeOverflowMode: DocumentTableOverflow = 'overflow';
  let activeBorderTarget: OfficeTableBorderActionTarget | null = null;
  let activeBorderState: OfficeTableBorderState | null = null;
  let activeAlignmentTarget: OfficeTableAlignmentActionTarget | null = null;
  let activeAlignment: DocumentTableAlignment = 'left';
  let rootAnchor = { clientX: 0, clientY: 0 };

  const closeNestedSubmenu = (focusTrigger = false) => {
    nestedSubmenu?.remove();
    nestedSubmenu = null;
    borderSizeTrigger?.setAttribute('aria-expanded', 'false');
    overflowTrigger?.setAttribute('aria-expanded', 'false');
    if (focusTrigger) nestedSubmenuTrigger?.focus({ preventScroll: true });
    nestedSubmenuTrigger = null;
  };

  const closeSubmenu = (focusTrigger = false) => {
    closeNestedSubmenu();
    submenu?.remove();
    submenu = null;
    borderSizeTrigger = null;
    overflowTrigger = null;
    tableTrigger?.setAttribute('aria-expanded', 'false');
    if (focusTrigger) tableTrigger?.focus({ preventScroll: true });
  };

  const hide = (restoreEditorFocus = false) => {
    closeSubmenu();
    menu?.remove();
    menu = null;
    tableTrigger = null;
    if (restoreEditorFocus) invokingView?.focus();
    invokingView = null;
    activeContext = null;
    activeRemovalCapture = null;
    activeOverflowTarget = null;
    activeOverflowMode = 'overflow';
    activeBorderTarget = null;
    activeBorderState = null;
    activeAlignmentTarget = null;
    activeAlignment = 'left';
  };

  const positionMenu = (clientX: number, clientY: number) => {
    if (!menu) return;
    rootAnchor = { clientX, clientY };
    clampMenuToViewport(menu, clientX, clientY);
  };

  const appendDivider = () => {
    if (!menu) return;
    const divider = document.createElement('div');
    divider.className = 'rv-office-table-context-divider';
    divider.setAttribute('role', 'separator');
    menu.appendChild(divider);
  };

  const appendAction = (
    context: OfficeTableContext,
    label: string,
    icon: string,
    action: OfficeTableAction,
    disabled = false,
    disabledReason?: string,
  ) => {
    if (!menu) return;
    const item = createOfficeTableContextItem(label, icon, () => {
      if (runOfficeTableAction(root, crepe, context, action)) hide();
    }, disabled, disabledReason);
    item.addEventListener('pointerenter', () => closeSubmenu());
    menu.appendChild(item);
  };

  const appendColorItem = (
    label: string,
    getCurrent: () => string | null,
    apply: (color: string | null) => boolean,
  ) => {
    if (!menu) return;
    const item = createOfficeTableContextItem(label, 'colors', () => {
      const rect = item.getBoundingClientRect();
      const current = getCurrent();
      // Keep the context menu open beside the picker; the color/None click
      // (onPick) is what dismisses both.
      popover.open({
        clientX: rect.right + 4,
        clientY: rect.top + 12,
        current,
        onPick: (color) => {
          if (!apply(color)) console.error(`[OfficeTable] ${label} rejected: invalid or unchanged target`);
          hide();
        },
      });
    });
    item.addEventListener('pointerenter', () => closeSubmenu());
    menu.appendChild(item);
  };

  const positionChildMenu = (
    parent: HTMLElement,
    child: HTMLElement,
    preferredTop: number,
  ) => {
    const parentRect = parent.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    const gap = 4;
    const preferredLeft = parentRect.right + gap + childRect.width <= window.innerWidth - 8
      ? parentRect.right + gap
      : parentRect.left - childRect.width - gap;
    clampMenuToViewport(child, preferredLeft, preferredTop);
  };

  const openOverflowSubmenu = (focusCurrent = false) => {
    if (!submenu || !overflowTrigger || !activeOverflowTarget) return;
    if (nestedSubmenu && nestedSubmenuTrigger !== overflowTrigger) closeNestedSubmenu();
    if (!nestedSubmenu) {
      nestedSubmenu = document.createElement('div');
      nestedSubmenu.className = [
        'rv-office-table-context-menu',
        'rv-office-table-context-submenu',
        'rv-office-table-context-nested-submenu',
      ].join(' ');
      nestedSubmenu.setAttribute('role', 'menu');
      nestedSubmenu.setAttribute('aria-label', 'Overflow');
      nestedSubmenu.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      OFFICE_TABLE_OVERFLOW_CHOICES.forEach(({ label, value }) => {
        const choice = createOfficeTableRadioChoice(
          label,
          activeOverflowMode === value,
          () => {
            if (!activeOverflowTarget) return;
            invokingView?.focus();
            const result = display.applyOverflow(activeOverflowTarget, value);
            if (result.applied || result.reason === 'no-change') {
              activeOverflowMode = value;
              hide(true);
              return;
            }
            console.error(`[OfficeTable] Overflow ${value} rejected: ${result.reason}`);
          },
        );
        nestedSubmenu?.appendChild(choice);
      });
      document.body.appendChild(nestedSubmenu);
      nestedSubmenuTrigger = overflowTrigger;
      overflowTrigger.setAttribute('aria-expanded', 'true');
      positionChildMenu(
        submenu,
        nestedSubmenu,
        overflowTrigger.getBoundingClientRect().top,
      );
    }
    if (focusCurrent) {
      const currentChoice = nestedSubmenu.querySelector<HTMLButtonElement>(
        '[role="menuitemradio"][aria-checked="true"]',
      );
      (currentChoice ?? menuItems(nestedSubmenu)[0])?.focus({ preventScroll: true });
    }
  };

  const openBorderSizeSubmenu = (focusCurrent = false) => {
    if (!submenu || !borderSizeTrigger || !activeBorderTarget || !activeBorderState) return;
    if (nestedSubmenu && nestedSubmenuTrigger !== borderSizeTrigger) closeNestedSubmenu();
    if (!nestedSubmenu) {
      nestedSubmenu = document.createElement('div');
      nestedSubmenu.className = [
        'rv-office-table-context-menu',
        'rv-office-table-context-submenu',
        'rv-office-table-context-nested-submenu',
      ].join(' ');
      nestedSubmenu.setAttribute('role', 'menu');
      nestedSubmenu.setAttribute('aria-label', 'Border size');
      nestedSubmenu.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      DOCUMENT_TABLE_BORDER_WIDTHS.forEach((borderWidth) => {
        const choice = createOfficeTableRadioChoice(
          `${borderWidth}px`,
          activeBorderState?.borderWidth === borderWidth,
          () => {
            if (!activeBorderTarget) return;
            invokingView?.focus();
            const result = display.applyBorderWidth(activeBorderTarget, borderWidth);
            if (result.applied || result.reason === 'no-change') {
              activeBorderState = { ...activeBorderState!, borderWidth };
              hide(true);
              return;
            }
            console.error(`[OfficeTable] Border size ${borderWidth}px rejected: ${result.reason}`);
          },
        );
        nestedSubmenu?.appendChild(choice);
      });
      document.body.appendChild(nestedSubmenu);
      nestedSubmenuTrigger = borderSizeTrigger;
      borderSizeTrigger.setAttribute('aria-expanded', 'true');
      positionChildMenu(
        submenu,
        nestedSubmenu,
        borderSizeTrigger.getBoundingClientRect().top,
      );
    }
    if (focusCurrent) {
      const currentChoice = nestedSubmenu.querySelector<HTMLButtonElement>(
        '[role="menuitemradio"][aria-checked="true"]',
      );
      (currentChoice ?? menuItems(nestedSubmenu)[0])?.focus({ preventScroll: true });
    }
  };

  const openTableSubmenu = (
    context: OfficeTableContext,
    capture: OfficeTableRemovalCapture,
    focusFirst = false,
  ) => {
    if (!menu || !tableTrigger) return;
    if (!submenu) {
      submenu = document.createElement('div');
      submenu.className = 'rv-office-table-context-menu rv-office-table-context-submenu';
      submenu.setAttribute('role', 'menu');
      submenu.setAttribute('aria-label', 'Table');
      submenu.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });

      const currentModeLabel = OFFICE_TABLE_OVERFLOW_CHOICES.find(
        ({ value }) => value === activeOverflowMode,
      )?.label ?? 'Overflow';
      const addTitleItem = createOfficeTableContextItem('Add title row', 'variable_add', () => {
        if (runOfficeTableTitleAction(root, crepe, context, 'add')) hide(true);
      }, context.topRowCellCount === 1);
      addTitleItem.addEventListener('pointerenter', () => closeNestedSubmenu());
      const borderWidth = activeBorderState?.borderWidth ?? 1;
      borderSizeTrigger = createOfficeTableContextItem('Border size', 'border_all', () => {
        openBorderSizeSubmenu(true);
      }, false, undefined, true);
      borderSizeTrigger.classList.add('rv-office-table-context-border-size-trigger');
      borderSizeTrigger.setAttribute('aria-label', activeBorderState?.borderColor === null
        ? `Border size: current width ${borderWidth}px. The editor guide uses ${borderWidth}px and output has no border.`
        : `Border size: current width ${borderWidth}px`);
      const currentBorderWidth = document.createElement('span');
      currentBorderWidth.className = 'rv-office-table-context-current';
      currentBorderWidth.setAttribute('aria-hidden', 'true');
      currentBorderWidth.textContent = `${borderWidth}px`;
      borderSizeTrigger.insertBefore(currentBorderWidth, borderSizeTrigger.lastElementChild);
      borderSizeTrigger.addEventListener('pointerenter', () => openBorderSizeSubmenu());
      const borderColorSummary = activeBorderState?.borderColor === null
        ? 'None'
        : activeBorderState?.borderColor === 'default' || !activeBorderState
          ? 'Default'
          : activeBorderState.borderColor;
      const borderColorItem = createOfficeTableContextItem('Border color', 'border_all', () => {
        if (!activeBorderTarget || !activeBorderState) return;
        closeNestedSubmenu();
        const rect = borderColorItem.getBoundingClientRect();
        popover.open({
          clientX: rect.right + 4,
          clientY: rect.top + 12,
          current: activeBorderState.borderColor === 'default'
            ? undefined
            : activeBorderState.borderColor,
          onPick: (color) => {
            if (!activeBorderTarget) return;
            const selectedColor = color === null
              ? null
              : color.toLowerCase() as `#${string}`;
            invokingView?.focus();
            const result = display.applyBorderColor(activeBorderTarget, selectedColor);
            if (result.applied || result.reason === 'no-change') {
              activeBorderState = {
                ...activeBorderState!,
                borderColor: selectedColor,
                paintColor: selectedColor ?? '#cccccc',
                paintStyle: selectedColor === null ? 'dotted' : 'solid',
              };
              hide(true);
              return;
            }
            console.error(`[OfficeTable] Border color rejected: ${result.reason}`);
          },
        });
      });
      borderColorItem.classList.add('rv-office-table-context-border-color');
      borderColorItem.setAttribute(
        'aria-label',
        `Border color: current color ${borderColorSummary}`,
      );
      const currentBorderColor = document.createElement('span');
      currentBorderColor.className = 'rv-office-table-context-current';
      currentBorderColor.setAttribute('aria-hidden', 'true');
      currentBorderColor.textContent = borderColorSummary;
      borderColorItem.appendChild(currentBorderColor);
      borderColorItem.addEventListener('pointerenter', () => closeNestedSubmenu());
      const alignmentItems = OFFICE_TABLE_ALIGNMENT_CHOICES.map(({ label, icon, value }) => {
        const item = createOfficeTableAlignmentChoice(
          label,
          icon,
          activeAlignment === value,
          () => {
            if (!activeAlignmentTarget) return;
            invokingView?.focus();
            const result = display.applyAlignment(activeAlignmentTarget, value);
            if (result.applied || result.reason === 'no-change') {
              activeAlignment = value;
              hide(true);
              return;
            }
            console.error(`[OfficeTable] Alignment ${value} rejected: ${result.reason}`);
          },
        );
        item.addEventListener('pointerenter', () => closeNestedSubmenu());
        return item;
      });
      overflowTrigger = createOfficeTableContextItem('Overflow', 'format_text_overflow', () => {
        openOverflowSubmenu(true);
      }, false, undefined, true);
      overflowTrigger.classList.add('rv-office-table-context-overflow-trigger');
      overflowTrigger.setAttribute('aria-label', `Overflow: current mode ${currentModeLabel}`);
      const currentMode = document.createElement('span');
      currentMode.className = 'rv-office-table-context-current';
      currentMode.setAttribute('aria-hidden', 'true');
      currentMode.textContent = currentModeLabel;
      overflowTrigger.insertBefore(currentMode, overflowTrigger.lastElementChild);
      overflowTrigger.addEventListener('pointerenter', () => openOverflowSubmenu());

      const titleDivider = document.createElement('div');
      titleDivider.className = 'rv-office-table-context-divider';
      titleDivider.setAttribute('role', 'separator');
      const borderDivider = titleDivider.cloneNode() as HTMLDivElement;
      const alignmentDivider = titleDivider.cloneNode() as HTMLDivElement;
      const removeDivider = titleDivider.cloneNode() as HTMLDivElement;
      const requestView = invokingView;
      const removeItem = createOfficeTableContextItem('Remove table', 'delete', () => {
        const request = new CustomEvent<OfficeTableRemoveRequest>(OFFICE_TABLE_REMOVE_REQUEST_EVENT, {
          bubbles: true,
          cancelable: true,
          detail: {
            context: { ...context },
            capture,
            restoreEditorFocus: () => requestView?.focus(),
          },
        });
        const restoreEditorFocus = root.dispatchEvent(request);
        hide(restoreEditorFocus);
      });
      removeItem.classList.add('rv-office-table-context-destructive');
      removeItem.addEventListener('pointerenter', () => closeNestedSubmenu());
      submenu.append(
        addTitleItem,
        titleDivider,
        borderSizeTrigger,
        borderColorItem,
        borderDivider,
        ...alignmentItems,
        alignmentDivider,
        overflowTrigger,
        removeDivider,
        removeItem,
      );
      document.body.appendChild(submenu);
      tableTrigger.setAttribute('aria-expanded', 'true');

      positionChildMenu(menu, submenu, menu.getBoundingClientRect().top);
    }
    if (focusFirst) menuItems(submenu)[0]?.focus({ preventScroll: true });
  };

  const show = (
    view: EditorView,
    context: OfficeTableContext,
    tableEl: HTMLTableElement | null,
    clientX: number,
    clientY: number,
  ) => {
    hide();
    invokingView = view;
    activeContext = context;
    activeRemovalCapture = captureOfficeTableRemovalTarget(view.state, context.tablePos);
    activeOverflowTarget = tableEl ? display.captureActionTarget(tableEl) : null;
    activeOverflowMode = tableEl ? display.resolveOverflow(tableEl) : 'overflow';
    activeBorderTarget = tableEl ? display.captureBorderActionTarget(tableEl) : null;
    activeBorderState = tableEl ? display.resolveBorders(tableEl) : null;
    activeAlignmentTarget = tableEl ? display.captureAlignmentActionTarget(tableEl) : null;
    activeAlignment = tableEl ? display.resolveAlignment(tableEl) : 'left';
    if (!activeRemovalCapture || !activeOverflowTarget || !activeBorderTarget || !activeBorderState
      || !activeAlignmentTarget) {
      invokingView = null;
      activeContext = null;
      activeRemovalCapture = null;
      activeOverflowTarget = null;
      activeBorderTarget = null;
      activeBorderState = null;
      activeAlignmentTarget = null;
      return;
    }
    menu = document.createElement('div');
    menu.className = 'rv-office-table-context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Table cell actions');
    menu.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    tableTrigger = createOfficeTableContextItem('Table', 'table_edit', () => {
      openTableSubmenu(context, activeRemovalCapture!, true);
    }, false, undefined, true);
    tableTrigger.addEventListener('pointerenter', () => {
      if (activeRemovalCapture) openTableSubmenu(context, activeRemovalCapture);
    });
    menu.appendChild(tableTrigger);
    appendDivider();

    const colorTarget = tableEl ? colors.captureActionTarget(tableEl, context.tablePos, {
      rowCount: context.rowCount,
      columnCount: context.colCount,
    }) : null;
    const applyColor = (target: OfficeTableColorActionTarget, action: OfficeTableColorAction) => {
      let applied = false;
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        view.focus();
        applied = colors.applyAction(view, target, action).applied;
      });
      return applied;
    };

    if (tableEl && colorTarget) {
      appendColorItem(
        'Cell Background',
        () => colors.resolveCellColor(tableEl, context.rowIndex, context.colIndex),
        (color) => applyColor(colorTarget, {
          target: 'cell',
          rowIndex: context.rowIndex,
          columnIndex: context.colIndex,
          value: color ?? 'none',
        }),
      );
      appendColorItem(
        'Row Background',
        () => colors.getRowColor(tableEl, context.rowIndex),
        (color) => applyColor(colorTarget, {
          target: 'row', index: context.rowIndex, value: color ?? 'none',
        }),
      );
      appendColorItem(
        'Column Background',
        () => colors.getColumnColor(tableEl, context.colIndex),
        (color) => applyColor(colorTarget, {
          target: 'column', index: context.colIndex, value: color ?? 'none',
        }),
      );
      appendDivider();
    }

    const titleContext = context.verifiedTitleContext === true;
    appendAction(context, 'Insert Row Above', 'add', 'insert-row-above', titleContext);
    appendAction(context, 'Insert Row Below', 'add', 'insert-row-below');
    appendAction(context, 'Insert Column Left', 'add', 'insert-col-left', titleContext);
    appendAction(context, 'Insert Column Right', 'add', 'insert-col-right', titleContext);

    const deleteActions: Array<[string, OfficeTableAction]> = [
      ['Delete Row Above', 'delete-row-above'],
      ['Delete Row Below', 'delete-row-below'],
      ['Delete Column Left', 'delete-col-left'],
      ['Delete Column Right', 'delete-col-right'],
    ];
    appendDivider();
    if (titleContext) {
      const deleteTitle = createOfficeTableContextItem('Delete Row', 'delete', () => {
        if (runOfficeTableTitleAction(root, crepe, context, 'delete')) hide(true);
      }, context.rowCount < 3);
      deleteTitle.addEventListener('pointerenter', () => closeSubmenu());
      menu.appendChild(deleteTitle);
    }
    deleteActions.forEach(([label, action]) => {
      const mutation = getOfficeTableMutationForAction(context, action);
      const disabledForTitle = (titleContext && [
        'delete-row-above', 'delete-col-left', 'delete-col-right',
      ].includes(action)) || Boolean(
        mutation && isOfficeTableMutationForbiddenForVerifiedTitle(context, mutation),
      );
      const disabledReason = disabledForTitle
        ? undefined
        : getOfficeTableActionDisabledReason(context, action);
      appendAction(
        context,
        label,
        'delete',
        action,
        disabledForTitle || Boolean(disabledReason),
        disabledReason,
      );
    });

    document.body.appendChild(menu);
    positionMenu(clientX, clientY);
    menuItems(menu)[0]?.focus({ preventScroll: true });
  };

  const onContextMenu = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.milkdown-table-block td, .milkdown-table-block th')) return;

    event.preventDefault();
    event.stopPropagation();
    const tableEl = event.target.closest<HTMLTableElement>('.rv-office-table');
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const context = getOfficeTableContext(view, event.clientX, event.clientY);
      if (context) show(view, context, tableEl, event.clientX, event.clientY);
    });
  };

  const onRightButtonDown = (event: MouseEvent | PointerEvent) => {
    if (event.button !== 2 || !(event.target instanceof Element)) return;
    if (!event.target.closest('.milkdown-table-block td, .milkdown-table-block th')) return;
    event.preventDefault();
    event.stopPropagation();
  };

  const onWindowPointerDown = (event: PointerEvent) => {
    const target = event.target;
    if (target instanceof Node && menu?.contains(target)) return;
    if (target instanceof Node && submenu?.contains(target)) return;
    if (target instanceof Node && nestedSubmenu?.contains(target)) return;
    // The color picker is a logical extension of this menu — clicking inside it
    // must not dismiss the menu.
    if (target instanceof Element && target.closest('.rv-office-color-popover')) return;
    hide();
  };

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (!menu) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      hide(true);
      return;
    }

    const activeMenu = nestedSubmenu?.contains(document.activeElement)
      ? nestedSubmenu
      : submenu?.contains(document.activeElement) ? submenu : menu;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      focusMenuItem(activeMenu, event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      if (activeMenu === nestedSubmenu) closeNestedSubmenu(true);
      else if (activeMenu === submenu) closeSubmenu(true);
      return;
    }
    if (event.key === 'ArrowRight' && document.activeElement === tableTrigger) {
      event.preventDefault();
      event.stopPropagation();
      if (activeContext && activeRemovalCapture) {
        openTableSubmenu(activeContext, activeRemovalCapture, true);
      }
      return;
    }
    if (event.key === 'ArrowRight' && document.activeElement === overflowTrigger) {
      event.preventDefault();
      event.stopPropagation();
      openOverflowSubmenu(true);
      return;
    }
    if (event.key === 'ArrowRight' && document.activeElement === borderSizeTrigger) {
      event.preventDefault();
      event.stopPropagation();
      openBorderSizeSubmenu(true);
      return;
    }
    if ((event.key === 'Enter' || event.key === ' ') && document.activeElement instanceof HTMLButtonElement) {
      event.preventDefault();
      event.stopPropagation();
      document.activeElement.click();
    }
  };

  const onWindowResize = () => {
    if (!menu) return;
    positionMenu(rootAnchor.clientX, rootAnchor.clientY);
    if (submenu && tableTrigger && activeContext) {
      closeSubmenu();
      if (activeRemovalCapture) openTableSubmenu(activeContext, activeRemovalCapture);
    }
  };

  root.addEventListener('pointerdown', onRightButtonDown, true);
  root.addEventListener('mousedown', onRightButtonDown, true);
  root.addEventListener('contextmenu', onContextMenu, true);
  window.addEventListener('pointerdown', onWindowPointerDown, true);
  window.addEventListener('keydown', onWindowKeyDown, true);
  window.addEventListener('resize', onWindowResize);

  return () => {
    unregisterMetadataSnapshot();
    root.removeEventListener('pointerdown', onRightButtonDown, true);
    root.removeEventListener('mousedown', onRightButtonDown, true);
    root.removeEventListener('contextmenu', onContextMenu, true);
    window.removeEventListener('pointerdown', onWindowPointerDown, true);
    window.removeEventListener('keydown', onWindowKeyDown, true);
    window.removeEventListener('resize', onWindowResize);
    hide();
  };
}
