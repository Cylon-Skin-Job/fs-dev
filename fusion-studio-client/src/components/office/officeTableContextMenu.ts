/**
 * @module officeTableContextMenu
 * @role Installs and orchestrates the Office table context-menu invocation lifecycle.
 */
import { Crepe } from '@milkdown/crepe';
import { commandsCtx, editorViewCtx } from '@milkdown/kit/core';
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
import {
  openMenuTree,
  type MenuExternalChildContext,
  type MenuHandle,
  type MenuOutcome,
} from '../menu';
import type {
  OfficeTableColorAction,
  OfficeTableColorActionTarget,
  OfficeTableColorsController,
} from './officeTableColors';
import type { ColorPopoverController } from './officeColorPopover';
import type { OfficeTableDisplayController } from './officeTableDisplay';
import {
  createOfficeTableMetadataPlugin,
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataSnapshot,
} from './officeTableHistory';
import {
  buildOfficeTableMenuDescriptors,
  type OfficeTableColorMenuItem,
} from './officeTableMenuDescriptors';
import {
  getOfficeTableContext,
  getOfficeTableMutationForAction,
  isOfficeTableMutationForbiddenForVerifiedTitle,
  type OfficeTableAction,
  type OfficeTableContext,
} from './officeTableMenuModel';
import {
  runCertifiedStockOfficeTableMutation,
  runOfficeTableTitleRowMutation,
} from './officeTableMutations';
import {
  captureOfficeTableRemovalTarget,
  type OfficeTableRemovalCapture,
} from './officeTableRemoval';

export {
  getLogicalTableCellContext,
  getOfficeTableActionDisabledReason,
  getOfficeTableMutationForAction,
  isOfficeTableMutationForbiddenForVerifiedTitle,
} from './officeTableMenuModel';
export type { OfficeTableAction, OfficeTableContext } from './officeTableMenuModel';

export const OFFICE_TABLE_REMOVE_REQUEST_EVENT = 'rv-office-table-remove-request';

export type OfficeTableRemoveRequest = {
  context: OfficeTableContext;
  capture: OfficeTableRemovalCapture;
  restoreEditorFocus: () => void;
};

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
    if (!result.applied) console.error(`[OfficeTable] ${action} rejected: ${result.reason}`);
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

function restoreEditorInvocation(view: EditorView, selection: EditorView['state']['selection']) {
  view.focus();
  if (!view.state.selection.eq(selection)) view.dispatch(view.state.tr.setSelection(selection));
}

const closeAll = (): MenuOutcome => ({ kind: 'close-all' });
const stayOpen = (): MenuOutcome => ({ kind: 'stay' });

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
  let menu: MenuHandle | null = null;

  const show = (
    view: EditorView,
    context: OfficeTableContext,
    tableEl: HTMLTableElement | null,
    clientX: number,
    clientY: number,
  ) => {
    const removalCapture = captureOfficeTableRemovalTarget(view.state, context.tablePos);
    const overflowTarget = tableEl ? display.captureActionTarget(tableEl) : null;
    const borderTarget = tableEl ? display.captureBorderActionTarget(tableEl) : null;
    const borderState = tableEl ? display.resolveBorders(tableEl) : null;
    const alignmentTarget = tableEl ? display.captureAlignmentActionTarget(tableEl) : null;
    if (!tableEl || !removalCapture || !overflowTarget || !borderTarget || !borderState || !alignmentTarget) return;
    const invocationSelection = view.state.selection;
    const restoreInvocation = () => restoreEditorInvocation(view, invocationSelection);

    const runDisplay = (
      label: string,
      apply: () => { applied: boolean; reason: string },
    ): MenuOutcome => {
      view.focus();
      const result = apply();
      if (result.applied || result.reason === 'no-change') return closeAll();
      console.error(`[OfficeTable] ${label} rejected: ${result.reason}`);
      return stayOpen();
    };
    const openColor = (
      item: Omit<OfficeTableColorMenuItem, 'onOpen'>,
      current: string | null | undefined,
      apply: (color: string | null) => boolean,
      retainOnReject = false,
    ): OfficeTableColorMenuItem => ({
      ...item,
      onOpen: (external: MenuExternalChildContext) => {
        popover.open({
          anchorElement: external.anchorElement,
          external,
          current,
          onPick: (color) => {
            if (apply(color)) return;
            if (retainOnReject) external.retainTreeOnNextAction();
            console.error(`[OfficeTable] ${item.label} rejected: invalid or unchanged target`);
          },
        });
      },
    });

    const borderColorSummary = borderState.borderColor === null
      ? 'None'
      : borderState.borderColor === 'default' ? 'Default' : borderState.borderColor;
    const borderColor = openColor({
      id: 'table-border-color',
      label: 'Border color',
      icon: 'border_all',
      secondaryText: borderColorSummary,
      ariaLabel: `Border color: current color ${borderColorSummary}`,
    }, borderState.borderColor === 'default' ? undefined : borderState.borderColor, (color) => {
      const selectedColor = color === null ? null : color.toLowerCase() as `#${string}`;
      view.focus();
      const result = display.applyBorderColor(borderTarget, selectedColor);
      if (result.applied || result.reason === 'no-change') return true;
      console.error(`[OfficeTable] Border color rejected: ${result.reason}`);
      return false;
    }, true);

    const colorTarget = colors.captureActionTarget(tableEl, context.tablePos, {
      rowCount: context.rowCount,
      columnCount: context.colCount,
    });
    const applyColor = (target: OfficeTableColorActionTarget, action: OfficeTableColorAction) => {
      let applied = false;
      crepe.editor.action((ctx) => {
        const editorView = ctx.get(editorViewCtx);
        editorView.focus();
        applied = colors.applyAction(editorView, target, action).applied;
      });
      return applied;
    };
    const colorItems = colorTarget ? [
      openColor(
        { id: 'table-cell-background', label: 'Cell Background' },
        colors.resolveCellColor(tableEl, context.rowIndex, context.colIndex),
        (color) => applyColor(colorTarget, {
          target: 'cell', rowIndex: context.rowIndex, columnIndex: context.colIndex, value: color ?? 'none',
        }),
      ),
      openColor(
        { id: 'table-row-background', label: 'Row Background' },
        colors.getRowColor(tableEl, context.rowIndex),
        (color) => applyColor(colorTarget, { target: 'row', index: context.rowIndex, value: color ?? 'none' }),
      ),
      openColor(
        { id: 'table-column-background', label: 'Column Background' },
        colors.getColumnColor(tableEl, context.colIndex),
        (color) => applyColor(colorTarget, { target: 'column', index: context.colIndex, value: color ?? 'none' }),
      ),
    ] as const : undefined;

    const items = buildOfficeTableMenuDescriptors({
      context,
      borderWidth: borderState.borderWidth,
      borderColor,
      alignment: display.resolveAlignment(tableEl),
      overflowMode: display.resolveOverflow(tableEl),
      colors: colorItems,
      actions: {
        runTitle: (action) => (
          runOfficeTableTitleAction(root, crepe, context, action) ? closeAll() : stayOpen()
        ),
        setBorderWidth: (width) => runDisplay(
          `Border size ${width}px`,
          () => display.applyBorderWidth(borderTarget, width),
        ),
        setAlignment: (alignment) => runDisplay(
          `Alignment ${alignment}`,
          () => display.applyAlignment(alignmentTarget, alignment),
        ),
        setOverflow: (overflow) => runDisplay(
          `Overflow ${overflow}`,
          () => display.applyOverflow(overflowTarget, overflow),
        ),
        runStructure: (action) => (
          runOfficeTableAction(root, crepe, context, action) ? closeAll() : stayOpen()
        ),
        removeTable: () => {
          const request = new CustomEvent<OfficeTableRemoveRequest>(OFFICE_TABLE_REMOVE_REQUEST_EVENT, {
            bubbles: true,
            cancelable: true,
            detail: { context: { ...context }, capture: removalCapture, restoreEditorFocus: restoreInvocation },
          });
          root.dispatchEvent(request);
          return closeAll();
        },
      },
    });

    menu?.close('replaced');
    menu = openMenuTree({
      anchor: { kind: 'pointer', clientX, clientY },
      items,
      ariaLabel: 'Table cell actions',
      restoreInvocationFocus: restoreInvocation,
      focusAfterAction: () => view.focus(),
      onActionError: (error, itemId) => console.error(`[OfficeTable] ${itemId} failed`, error),
      onClose: () => { menu = null; },
    });
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

  root.addEventListener('pointerdown', onRightButtonDown, true);
  root.addEventListener('mousedown', onRightButtonDown, true);
  root.addEventListener('contextmenu', onContextMenu, true);
  return () => {
    unregisterMetadataSnapshot();
    root.removeEventListener('pointerdown', onRightButtonDown, true);
    root.removeEventListener('mousedown', onRightButtonDown, true);
    root.removeEventListener('contextmenu', onContextMenu, true);
    menu?.close('programmatic');
    menu = null;
  };
}
