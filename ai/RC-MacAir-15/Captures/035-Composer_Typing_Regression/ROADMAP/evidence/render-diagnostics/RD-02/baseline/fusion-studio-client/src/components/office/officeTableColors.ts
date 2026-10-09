/**
 * @module officeTableColors
 * @role Adapts live Office table metadata/history/DOM surfaces to pure color decisions.
 */
import { TableMap } from '@milkdown/kit/prose/tables';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { EditorView } from '@milkdown/kit/prose/view';
import {
  cloneOfficeTableRawValue,
  type DocumentTableColors,
} from '../../lib/front-matter';
import {
  applyColorPolicy,
  type OfficeTableColorAction,
  type OfficeTableColorDimensions,
  type OfficeTableColorRules,
  type OfficeTableColorRulesInput,
} from './officeTableColorPolicy';
import {
  renderOfficeTableColorStylesheet,
  rulesToBandColor,
  rulesToCellColor,
  type OfficeTableColorStylesheetTable,
} from './officeTableColorRender';
import {
  findStructureTableIdentityEntry,
  fingerprintProseTable,
  getDomTableLogicalWidth,
  getOfficeTables,
  identityForDomTable,
  mapOfficeDomTableLogicalCells,
  type OfficeTableIdentity,
} from './officeTableIdentity';
import {
  dispatchOfficeTableMetadataAction,
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataActionResult,
} from './officeTableHistory';

export type { OfficeTableColorAction, OfficeTableColorDimensions } from './officeTableColorPolicy';

export type OfficeTableColorsController = {
  applyColors: () => void;
  readColors: () => unknown;
  resolveCellColor: (table: HTMLTableElement, rowIndex: number, colIndex: number) => string | null;
  getRowColor: (table: HTMLTableElement, rowIndex: number) => string | null;
  getColumnColor: (table: HTMLTableElement, colIndex: number) => string | null;
  captureActionTarget: (
    table: HTMLTableElement,
    tablePos: number,
    dimensions: OfficeTableColorDimensions,
  ) => OfficeTableColorActionTarget | null;
  applyAction: (
    view: EditorView,
    target: OfficeTableColorActionTarget,
    action: OfficeTableColorAction,
  ) => OfficeTableMetadataActionResult | { applied: false; reason: 'invalid-target' };
  cleanup: () => void;
};

export type OfficeTableColorActionPreparation = {
  tableColors: unknown;
  changed: boolean;
};

export type OfficeTableColorActionTarget = {
  table: HTMLTableElement;
  tablePos: number;
  identity: OfficeTableIdentity;
  dimensions: OfficeTableColorDimensions;
};

function cloneColors<T>(value: T): T {
  return cloneOfficeTableRawValue(value);
}

function snapshotsEqual(left: unknown, right: unknown, seen = new WeakMap<object, object>()): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (seen.get(left as object) === right) return true;
  seen.set(left as object, right);
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length
    || leftKeys.some((key, index) => key !== rightKeys[index])) return false;
  return leftKeys.every((key) => snapshotsEqual(
    (left as Record<string, unknown>)[key],
    (right as Record<string, unknown>)[key],
    seen,
  ));
}

function rulesFromEntry(entry: DocumentTableColors | undefined): OfficeTableColorRulesInput {
  return entry ? { cells: entry.cells, rows: entry.rows, columns: entry.columns } : {};
}

function hasRules(rules: OfficeTableColorRules): boolean {
  return Boolean(rules.cells || rules.rows || rules.columns);
}

function hasOpaqueColorFields(entry: DocumentTableColors): boolean {
  return Object.keys(entry).some((key) => ![
    'tableIndex', 'fingerprint', 'cells', 'rows', 'columns',
  ].includes(key));
}

function mergeRulesIntoEntry(
  entry: DocumentTableColors | undefined,
  identity: OfficeTableIdentity,
  rules: OfficeTableColorRules,
): DocumentTableColors {
  const stored = entry ? cloneColors(entry) : {};
  const next = Object.fromEntries(Object.entries(stored).filter(([key]) => ![
    'cells', 'rows', 'columns',
  ].includes(key))) as DocumentTableColors;
  Object.assign(next, identity);
  if (rules.cells) next.cells = cloneColors(rules.cells);
  if (rules.rows) next.rows = cloneColors(rules.rows);
  if (rules.columns) next.columns = cloneColors(rules.columns);
  return next;
}

/** Prepare the target collection around the storage-agnostic policy result. */
export function prepareOfficeTableColorAction(
  tableColors: unknown,
  target: OfficeTableIdentity,
  dimensions: OfficeTableColorDimensions,
  action: OfficeTableColorAction,
  liveTables: readonly OfficeTableIdentity[] = [],
): OfficeTableColorActionPreparation {
  const unchanged = (): OfficeTableColorActionPreparation => ({
    tableColors: cloneColors(tableColors),
    changed: false,
  });
  if (!Array.isArray(tableColors)) return unchanged();
  const targetEntry = findStructureTableIdentityEntry<DocumentTableColors>(
    tableColors,
    target,
    liveTables,
  );
  const nextRules = applyColorPolicy(rulesFromEntry(targetEntry), action, dimensions);
  if (!targetEntry && !hasRules(nextRules)) return unchanged();
  const nextEntry = mergeRulesIntoEntry(targetEntry, target, nextRules);
  const keepEntry = hasRules(nextRules) || hasOpaqueColorFields(nextEntry);
  const nextColors = targetEntry
    ? tableColors.flatMap((value) => value === targetEntry
      ? keepEntry ? [nextEntry] : []
      : [cloneColors(value)])
    : [...cloneColors(tableColors), nextEntry];
  return {
    tableColors: nextColors,
    changed: targetEntry ? !snapshotsEqual(nextColors, tableColors) : true,
  };
}

export function installOfficeTableColors(
  root: HTMLElement,
  initialColors: unknown,
): OfficeTableColorsController {
  let colors: unknown = cloneColors(initialColors);
  let refreshFrame = 0;

  const entryFor = (table: HTMLTableElement): DocumentTableColors | undefined => {
    const tables = getOfficeTables(root);
    return findStructureTableIdentityEntry<DocumentTableColors>(
      colors,
      identityForDomTable(root, table),
      tables.map((candidate) => identityForDomTable(root, candidate)),
    );
  };

  const styleId = `rv-tc-${Math.random().toString(36).slice(2, 8)}`;
  const styleEl = document.createElement('style');
  document.head.appendChild(styleEl);

  const applyColors = () => {
    const stylesheetTables: OfficeTableColorStylesheetTable[] = [];
    getOfficeTables(root).forEach((table, tableIndex) => {
      const entry = entryFor(table);
      const tableId = `${styleId}-${tableIndex}`;
      if (!entry) {
        if (table.dataset.rvTid) delete table.dataset.rvTid;
        return;
      }
      if (table.dataset.rvTid !== tableId) table.dataset.rvTid = tableId;
      const logicalCells = mapOfficeDomTableLogicalCells(table);
      const cells = Array.from(table.rows).flatMap((row, physicalRowIndex) => (
        Array.from(row.cells).map((cell, physicalColumnIndex) => {
          const logical = logicalCells.get(cell) ?? {
            rowIndex: physicalRowIndex,
            colIndex: physicalColumnIndex,
          };
          return {
            rowIndex: logical.rowIndex,
            columnIndex: logical.colIndex,
            physicalRowIndex,
            physicalColumnIndex,
          };
        })
      ));
      stylesheetTables.push({ tableId, rules: rulesFromEntry(entry), cells });
    });
    const css = renderOfficeTableColorStylesheet(stylesheetTables);
    if (styleEl.textContent !== css) styleEl.textContent = css;
  };

  const resolveCellColor = (table: HTMLTableElement, rowIndex: number, colIndex: number) => (
    rulesToCellColor(rulesFromEntry(entryFor(table)), rowIndex, colIndex)
  );

  const getRowColor = (table: HTMLTableElement, rowIndex: number) => (
    rulesToBandColor(rulesFromEntry(entryFor(table)), 'row', rowIndex)
  );

  const getColumnColor = (table: HTMLTableElement, colIndex: number) => (
    rulesToBandColor(rulesFromEntry(entryFor(table)), 'column', colIndex)
  );

  const captureActionTarget = (
    table: HTMLTableElement,
    tablePos: number,
    dimensions: OfficeTableColorDimensions,
  ): OfficeTableColorActionTarget | null => {
    const identity = identityForDomTable(root, table);
    if (!root.contains(table) || identity.tableIndex < 0
      || table.rows.length !== dimensions.rowCount
      || getDomTableLogicalWidth(table) !== dimensions.columnCount) return null;
    return { table, tablePos, identity, dimensions: { ...dimensions } };
  };

  const proseTables = (document: ProseNode) => {
    const tables: Array<{ node: ProseNode; pos: number; identity: OfficeTableIdentity }> = [];
    document.descendants((node, pos) => {
      if (node.type.name !== 'table') return true;
      tables.push({
        node,
        pos,
        identity: { tableIndex: tables.length, fingerprint: fingerprintProseTable(node) },
      });
      return false;
    });
    return tables;
  };

  const applyAction = (
    view: EditorView,
    target: OfficeTableColorActionTarget,
    action: OfficeTableColorAction,
  ): OfficeTableMetadataActionResult | { applied: false; reason: 'invalid-target' } => {
    const domIdentity = identityForDomTable(root, target.table);
    const documentTables = proseTables(view.state.doc);
    const documentTarget = documentTables.find(({ pos, node }) => (
      target.tablePos >= pos && target.tablePos <= pos + node.nodeSize
    ));
    if (!root.contains(target.table)
      || getOfficeTables(root)[target.identity.tableIndex] !== target.table
      || domIdentity.tableIndex !== target.identity.tableIndex
      || domIdentity.fingerprint !== target.identity.fingerprint
      || target.table.rows.length !== target.dimensions.rowCount
      || getDomTableLogicalWidth(target.table) !== target.dimensions.columnCount
      || !documentTarget
      || documentTarget.identity.tableIndex !== target.identity.tableIndex
      || documentTarget.identity.fingerprint !== target.identity.fingerprint) {
      return { applied: false, reason: 'invalid-target' };
    }
    const map = TableMap.get(documentTarget.node);
    if (map.problems?.length || map.height !== target.dimensions.rowCount
      || map.width !== target.dimensions.columnCount) {
      return { applied: false, reason: 'invalid-target' };
    }
    return dispatchOfficeTableMetadataAction(root, view, (before) => {
      const prepared = prepareOfficeTableColorAction(
        before.tableColors,
        target.identity,
        target.dimensions,
        action,
        documentTables.map(({ identity }) => identity),
      );
      return prepared.changed
        ? {
          tables: cloneColors(before.tables),
          tableColors: prepared.tableColors,
          ...(Object.hasOwn(before, 'tableStyles')
            ? { tableStyles: cloneColors(before.tableStyles) }
            : {}),
        }
        : null;
    });
  };

  const publishColors = (nextColors: unknown) => {
    colors = cloneColors(nextColors);
    applyColors();
  };

  const unregisterMetadata = registerOfficeTableMetadataBindings(root, {
    readTableColors: () => cloneColors(colors),
    publishTableColors: publishColors,
    renderTableColors: applyColors,
  });

  const scheduleRefresh = () => {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      applyColors();
    });
  };

  const observer = new MutationObserver(() => scheduleRefresh());
  observer.observe(root, { childList: true, subtree: true });

  return {
    applyColors,
    readColors: () => cloneColors(colors),
    resolveCellColor,
    getRowColor,
    getColumnColor,
    captureActionTarget,
    applyAction,
    cleanup: () => {
      unregisterMetadata();
      observer.disconnect();
      if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
      styleEl.remove();
    },
  };
}
