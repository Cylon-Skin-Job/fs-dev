/**
 * @module officeTableDisplay
 * @role Apply normalized table-wide display metadata to Office-owned table chrome.
 */
import {
  cloneOfficeTableRawValue,
  DEFAULT_DOCUMENT_TABLE_ALIGNMENT,
  DEFAULT_DOCUMENT_TABLE_BORDER_COLOR,
  DEFAULT_DOCUMENT_TABLE_BORDER_WIDTH,
  DEFAULT_DOCUMENT_TABLE_OVERFLOW,
  normalizeDocumentTableBorderColor,
  normalizeDocumentTableBorderWidth,
  normalizeDocumentTableOverflow,
  type DocumentTableBorderColor,
  type DocumentTableBorderWidth,
  type DocumentTableAlignment,
  type DocumentTableOverflow,
  type DocumentTableStyle,
  type DocumentSettings,
} from '../../lib/front-matter';
import {
  findTableIdentityEntry,
  findStructureTableIdentityEntry,
  fingerprintDomTable,
  getOfficeTables,
  identityForDomTable,
  type OfficeTableIdentity,
} from './officeTableIdentity';
import {
  registerOfficeTableMetadataBindings,
  type OfficeTableMetadataActionResult,
  type OfficeTableMetadataSnapshot,
} from './officeTableHistory';
import {
  planOfficePageAlignmentFlow,
  resolveOfficePageAlignmentFlowValue,
  type OfficePageAlignment,
} from './officePageAlignmentFlow';

export type OfficeTableOverflowActionTarget = OfficeTableIdentity;

export type OfficeTableBorderActionTarget = OfficeTableIdentity & {
  table: HTMLTableElement;
};

export type OfficeTableAlignmentActionTarget = OfficeTableIdentity & {
  table: HTMLTableElement;
};

export type OfficeTableBorderState = {
  borderWidth: DocumentTableBorderWidth;
  borderColor: DocumentTableBorderColor;
  paintColor: string;
  paintStyle: 'solid' | 'dotted';
};

export type OfficeTableBorderColorSelection = string | null;

export type OfficeTableAlignmentState = DocumentTableAlignment;

function resolveOfficeTableAlignmentValue(
  value: unknown,
  pageAlignment: OfficePageAlignment,
): DocumentTableAlignment {
  return value === 'left' || value === 'center' || value === 'right'
    ? value
    : resolveOfficePageAlignmentFlowValue(pageAlignment);
}

type CommitOfficeTableOverflow = (
  prepare: (
    before: OfficeTableMetadataSnapshot,
  ) => OfficeTableMetadataSnapshot | null,
) => OfficeTableMetadataActionResult;

export type OfficeTableDisplayController = {
  applyDisplay: () => void;
  readStyles: () => unknown;
  captureActionTarget: (table: HTMLTableElement) => OfficeTableOverflowActionTarget | null;
  captureBorderActionTarget: (table: HTMLTableElement) => OfficeTableBorderActionTarget | null;
  captureAlignmentActionTarget: (table: HTMLTableElement) => OfficeTableAlignmentActionTarget | null;
  resolveOverflow: (table: HTMLTableElement) => DocumentTableOverflow;
  resolveBorders: (table: HTMLTableElement) => OfficeTableBorderState;
  resolveAlignment: (table: HTMLTableElement) => OfficeTableAlignmentState;
  applyOverflow: (
    target: OfficeTableOverflowActionTarget,
    overflow: DocumentTableOverflow,
  ) => OfficeTableMetadataActionResult;
  applyBorderWidth: (
    target: OfficeTableBorderActionTarget,
    borderWidth: DocumentTableBorderWidth,
  ) => OfficeTableMetadataActionResult;
  applyBorderColor: (
    target: OfficeTableBorderActionTarget,
    borderColor: OfficeTableBorderColorSelection,
  ) => OfficeTableMetadataActionResult;
  applyAlignment: (
    target: OfficeTableAlignmentActionTarget,
    alignment: DocumentTableAlignment,
  ) => OfficeTableMetadataActionResult;
  applyPageAlignment: (alignment: OfficePageAlignment) => OfficeTableMetadataActionResult;
  cleanup: () => void;
};

export function resolveOfficeTableOverflow(
  styles: unknown,
  table: HTMLTableElement,
  tableIndex: number,
): DocumentTableOverflow {
  const entry = findTableIdentityEntry<DocumentTableStyle>(
    styles,
    { tableIndex, fingerprint: fingerprintDomTable(table) },
  );
  return entry
    ? normalizeDocumentTableOverflow(entry.tableOverflow)
    : DEFAULT_DOCUMENT_TABLE_OVERFLOW;
}

export function resolveOfficeTableBorders(
  styles: unknown,
  table: HTMLTableElement,
  tableIndex: number,
): OfficeTableBorderState {
  const entry = findTableIdentityEntry<DocumentTableStyle>(
    styles,
    { tableIndex, fingerprint: fingerprintDomTable(table) },
  );
  const borderWidth = entry
    ? normalizeDocumentTableBorderWidth(entry.borderWidth)
    : DEFAULT_DOCUMENT_TABLE_BORDER_WIDTH;
  const borderColor = entry
    ? normalizeDocumentTableBorderColor(entry.borderColor)
    : 'default';
  return {
    borderWidth,
    borderColor,
    paintColor: borderColor === null
      ? '#cccccc'
      : borderColor === 'default'
        ? DEFAULT_DOCUMENT_TABLE_BORDER_COLOR
        : borderColor,
    paintStyle: borderColor === null ? 'dotted' : 'solid',
  };
}

export function resolveOfficeTableAlignment(
  styles: unknown,
  table: HTMLTableElement,
  tableIndex: number,
  liveTables: readonly OfficeTableIdentity[] = [],
  pageAlignment: OfficePageAlignment = 'left',
): OfficeTableAlignmentState {
  const entry = findStructureTableIdentityEntry<DocumentTableStyle>(
    styles,
    { tableIndex, fingerprint: fingerprintDomTable(table) },
    liveTables,
  );
  return resolveOfficeTableAlignmentValue(entry?.tableAlignment, pageAlignment);
}

export function prepareOfficeTableOverflowChange(
  before: OfficeTableMetadataSnapshot,
  target: OfficeTableOverflowActionTarget,
  overflow: DocumentTableOverflow,
): OfficeTableMetadataSnapshot | null {
  const currentStyles = Array.isArray(before.tableStyles)
    ? cloneOfficeTableRawValue(before.tableStyles)
    : [];
  const matchedEntry = findTableIdentityEntry<Record<string, unknown>>(
    currentStyles,
    target,
  );
  const currentOverflow = matchedEntry
    ? normalizeDocumentTableOverflow(matchedEntry.tableOverflow)
    : DEFAULT_DOCUMENT_TABLE_OVERFLOW;
  if (currentOverflow === overflow) return null;

  if (matchedEntry) {
    const matchedIndex = currentStyles.indexOf(matchedEntry);
    if (matchedIndex < 0) return null;
    currentStyles[matchedIndex] = {
      ...cloneOfficeTableRawValue(matchedEntry),
      tableOverflow: overflow,
    };
  } else {
    currentStyles.push({
      tableIndex: target.tableIndex,
      fingerprint: target.fingerprint,
      tableOverflow: overflow,
    });
  }

  return {
    ...cloneOfficeTableRawValue(before),
    tableStyles: currentStyles,
  };
}

export function prepareOfficeTableAlignmentChange(
  before: OfficeTableMetadataSnapshot,
  target: OfficeTableIdentity,
  alignment: DocumentTableAlignment,
  liveTables: readonly OfficeTableIdentity[] = [],
): OfficeTableMetadataSnapshot | null {
  const currentStyles = Array.isArray(before.tableStyles)
    ? cloneOfficeTableRawValue(before.tableStyles)
    : [];
  const matchedEntry = findStructureTableIdentityEntry<Record<string, unknown>>(
    currentStyles,
    target,
    liveTables,
  );

  const currentAlignment = resolveOfficeTableAlignmentValue(
    matchedEntry?.tableAlignment,
    before.pageAlignment ?? 'left',
  );
  if (currentAlignment === alignment) return null;

  if (matchedEntry) {
    const matchedIndex = currentStyles.indexOf(matchedEntry);
    if (matchedIndex < 0) return null;
    currentStyles[matchedIndex] = {
      ...cloneOfficeTableRawValue(matchedEntry),
      tableAlignment: alignment,
    };
  } else {
    currentStyles.push({
      tableIndex: target.tableIndex,
      fingerprint: target.fingerprint,
      tableAlignment: alignment,
    });
  }

  return {
    ...cloneOfficeTableRawValue(before),
    tableStyles: currentStyles,
  };
}

export function prepareOfficePageAlignmentFlowChange(
  before: OfficeTableMetadataSnapshot,
  alignment: OfficePageAlignment,
  liveTables: readonly OfficeTableIdentity[],
): OfficeTableMetadataSnapshot | null {
  const oldAlignment = before.pageAlignment;
  if (!oldAlignment || oldAlignment === alignment) return null;

  const currentStyles = Array.isArray(before.tableStyles)
    ? cloneOfficeTableRawValue(before.tableStyles)
    : [];
  const currentValues = liveTables.map((target) => {
    const entry = findStructureTableIdentityEntry<Record<string, unknown>>(
      currentStyles,
      target,
      liveTables,
    );
    return resolveOfficeTableAlignmentValue(entry?.tableAlignment, oldAlignment);
  });
  const plan = planOfficePageAlignmentFlow(oldAlignment, alignment, currentValues);
  let rewroteExplicitFollower = false;

  if (plan.oldValue !== plan.newValue) {
    for (const tableIndex of plan.changedIndexes) {
      const target = liveTables[tableIndex];
      if (!target) continue;
      const entry = findStructureTableIdentityEntry<Record<string, unknown>>(
        currentStyles,
        target,
        liveTables,
      );
      // Missing and invalid storage is page-derived and must remain untouched:
      // changing the page already moves its effective value without an eager
      // canonical rewrite. Only explicit canonical followers need persistence.
      if (!entry || (entry.tableAlignment !== 'left'
        && entry.tableAlignment !== 'center'
        && entry.tableAlignment !== 'right')) continue;
      const styleIndex = currentStyles.indexOf(entry);
      if (styleIndex < 0) return null;
      currentStyles[styleIndex] = {
        ...cloneOfficeTableRawValue(entry),
        tableAlignment: plan.newValue,
      };
      rewroteExplicitFollower = true;
    }
  }

  return {
    ...cloneOfficeTableRawValue(before),
    pageAlignment: alignment,
    ...(rewroteExplicitFollower ? { tableStyles: currentStyles } : {}),
  };
}

function canonicalBorderColorForMutation(value: unknown): `#${string}` | null | undefined {
  if (value === null) return null;
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
    return value.toLowerCase() as `#${string}`;
  }
  return undefined;
}

function canonicalBorderWidthForMutation(value: unknown): DocumentTableBorderWidth | undefined {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined;
}

export function prepareOfficeTableBorderWidthChange(
  before: OfficeTableMetadataSnapshot,
  target: OfficeTableIdentity,
  borderWidth: DocumentTableBorderWidth,
): OfficeTableMetadataSnapshot | null {
  const currentStyles = Array.isArray(before.tableStyles)
    ? cloneOfficeTableRawValue(before.tableStyles)
    : [];
  const matchedEntry = findTableIdentityEntry<Record<string, unknown>>(
    currentStyles,
    target,
  );

  // An already-canonical selected width is a complete no-op. Effective
  // defaults and invalid raw widths deliberately do not satisfy this check.
  if (matchedEntry?.borderWidth === borderWidth) return null;

  if (matchedEntry) {
    const matchedIndex = currentStyles.indexOf(matchedEntry);
    if (matchedIndex < 0) return null;
    const nextEntry: Record<string, unknown> = {
      ...cloneOfficeTableRawValue(matchedEntry),
      borderWidth,
    };
    if (Object.hasOwn(matchedEntry, 'borderColor')) {
      const canonicalColor = canonicalBorderColorForMutation(matchedEntry.borderColor);
      if (canonicalColor === undefined) delete nextEntry.borderColor;
      else nextEntry.borderColor = canonicalColor;
    }
    currentStyles[matchedIndex] = nextEntry;
  } else {
    currentStyles.push({
      tableIndex: target.tableIndex,
      fingerprint: target.fingerprint,
      borderWidth,
    });
  }

  return {
    ...cloneOfficeTableRawValue(before),
    tableStyles: currentStyles,
  };
}

export function prepareOfficeTableBorderColorChange(
  before: OfficeTableMetadataSnapshot,
  target: OfficeTableIdentity,
  borderColor: OfficeTableBorderColorSelection,
): OfficeTableMetadataSnapshot | null {
  const selectedColor = canonicalBorderColorForMutation(borderColor);
  if (selectedColor === undefined) return null;
  const currentStyles = Array.isArray(before.tableStyles)
    ? cloneOfficeTableRawValue(before.tableStyles)
    : [];
  const matchedEntry = findTableIdentityEntry<Record<string, unknown>>(
    currentStyles,
    target,
  );

  // Only an already-canonical stored selection is a complete no-op. Invalid,
  // missing, and noncanonical raw colors deliberately canonicalize on pick.
  if (matchedEntry?.borderColor === selectedColor) return null;

  if (matchedEntry) {
    const matchedIndex = currentStyles.indexOf(matchedEntry);
    if (matchedIndex < 0) return null;
    const nextEntry: Record<string, unknown> = {
      ...cloneOfficeTableRawValue(matchedEntry),
      borderColor: selectedColor,
    };
    if (Object.hasOwn(matchedEntry, 'borderWidth')) {
      const canonicalWidth = canonicalBorderWidthForMutation(matchedEntry.borderWidth);
      if (canonicalWidth === undefined) delete nextEntry.borderWidth;
      else nextEntry.borderWidth = canonicalWidth;
    }
    currentStyles[matchedIndex] = nextEntry;
  } else {
    currentStyles.push({
      tableIndex: target.tableIndex,
      fingerprint: target.fingerprint,
      borderColor: selectedColor,
    });
  }

  return {
    ...cloneOfficeTableRawValue(before),
    tableStyles: currentStyles,
  };
}

export function installOfficeTableDisplay(
  root: HTMLElement,
  initialStyles: unknown,
  commit: CommitOfficeTableOverflow,
  getPageAlignment: () => DocumentSettings['alignment'] = () => 'left',
): OfficeTableDisplayController {
  let styles = cloneOfficeTableRawValue(initialStyles);
  let refreshFrame = 0;

  const applyDisplay = () => {
    const tables = getOfficeTables(root);
    const liveTables = tables.map((table) => identityForDomTable(root, table));
    tables.forEach((table, tableIndex) => {
      const overflow = resolveOfficeTableOverflow(styles, table, tableIndex);
      const border = resolveOfficeTableBorders(styles, table, tableIndex);
      const alignment = resolveOfficeTableAlignment(
        styles,
        table,
        tableIndex,
        liveTables,
        getPageAlignment(),
      );
      if (table.dataset.rvTableOverflow !== overflow) {
        table.dataset.rvTableOverflow = overflow;
      }
      if (table.dataset.rvTableAlignment !== alignment) {
        table.dataset.rvTableAlignment = alignment;
      }
      const borderState = border.borderColor === null
        ? 'none'
        : border.borderColor === 'default' ? 'default' : 'color';
      if (table.dataset.rvTableBorderColor !== borderState) {
        table.dataset.rvTableBorderColor = borderState;
      }
      if (table.dataset.rvTableBorderStyle !== border.paintStyle) {
        table.dataset.rvTableBorderStyle = border.paintStyle;
      }
      const borderWidth = `${border.borderWidth}px`;
      if (table.style.getPropertyValue('--rv-office-table-border-width') !== borderWidth) {
        table.style.setProperty('--rv-office-table-border-width', borderWidth);
      }
      if (table.style.getPropertyValue('--rv-office-table-border-color') !== border.paintColor) {
        table.style.setProperty('--rv-office-table-border-color', border.paintColor);
      }
    });
  };

  const unregisterMetadata = registerOfficeTableMetadataBindings(root, {
    readTableStyles: () => cloneOfficeTableRawValue(styles),
    publishTableStyles: (nextStyles) => {
      styles = cloneOfficeTableRawValue(nextStyles);
      applyDisplay();
    },
    renderTableStyles: applyDisplay,
  });

  const scheduleRefresh = () => {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      applyDisplay();
    });
  };

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(root, { childList: true, subtree: true });

  const isCurrentTableTarget = (target: OfficeTableBorderActionTarget) => {
    if (!target.table.isConnected || !root.contains(target.table)) return false;
    const currentTarget = identityForDomTable(root, target.table);
    return currentTarget.tableIndex === target.tableIndex
      && currentTarget.fingerprint === target.fingerprint;
  };

  return {
    applyDisplay,
    readStyles: () => cloneOfficeTableRawValue(styles),
    captureActionTarget: (table) => {
      if (!table.isConnected || !root.contains(table)) return null;
      const target = identityForDomTable(root, table);
      return target.tableIndex >= 0 ? target : null;
    },
    captureBorderActionTarget: (table) => {
      if (!table.isConnected || !root.contains(table)) return null;
      const target = identityForDomTable(root, table);
      return target.tableIndex >= 0 ? { ...target, table } : null;
    },
    captureAlignmentActionTarget: (table) => {
      if (!table.isConnected || !root.contains(table)) return null;
      const target = identityForDomTable(root, table);
      return target.tableIndex >= 0 ? { ...target, table } : null;
    },
    resolveOverflow: (table) => {
      const tableIndex = getOfficeTables(root).indexOf(table);
      return tableIndex >= 0
        ? resolveOfficeTableOverflow(styles, table, tableIndex)
        : DEFAULT_DOCUMENT_TABLE_OVERFLOW;
    },
    resolveBorders: (table) => {
      const tableIndex = getOfficeTables(root).indexOf(table);
      return tableIndex >= 0
        ? resolveOfficeTableBorders(styles, table, tableIndex)
        : {
          borderWidth: DEFAULT_DOCUMENT_TABLE_BORDER_WIDTH,
          borderColor: 'default',
          paintColor: DEFAULT_DOCUMENT_TABLE_BORDER_COLOR,
          paintStyle: 'solid',
        };
    },
    resolveAlignment: (table) => {
      const tables = getOfficeTables(root);
      const tableIndex = tables.indexOf(table);
      return tableIndex >= 0
        ? resolveOfficeTableAlignment(
          styles,
          table,
          tableIndex,
          tables.map((candidate) => identityForDomTable(root, candidate)),
          getPageAlignment(),
        )
        : DEFAULT_DOCUMENT_TABLE_ALIGNMENT;
    },
    applyOverflow: (target, overflow) => commit(
      (before) => prepareOfficeTableOverflowChange(before, target, overflow),
    ),
    applyBorderWidth: (target, borderWidth) => {
      if (!isCurrentTableTarget(target)) {
        return { applied: false, reason: 'metadata-unavailable' };
      }
      return commit(
        (before) => prepareOfficeTableBorderWidthChange(before, target, borderWidth),
      );
    },
    applyBorderColor: (target, borderColor) => {
      if (!isCurrentTableTarget(target)) {
        return { applied: false, reason: 'metadata-unavailable' };
      }
      return commit(
        (before) => prepareOfficeTableBorderColorChange(before, target, borderColor),
      );
    },
    applyAlignment: (target, alignment) => {
      if (!isCurrentTableTarget(target)) {
        return { applied: false, reason: 'metadata-unavailable' };
      }
      const liveTables = getOfficeTables(root).map(
        (table) => identityForDomTable(root, table),
      );
      return commit(
        (before) => prepareOfficeTableAlignmentChange(before, target, alignment, liveTables),
      );
    },
    applyPageAlignment: (alignment) => {
      const liveTables = getOfficeTables(root).map(
        (table) => identityForDomTable(root, table),
      );
      return commit(
        (before) => prepareOfficePageAlignmentFlowChange(before, alignment, liveTables),
      );
    },
    cleanup: () => {
      unregisterMetadata();
      observer.disconnect();
      if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
    },
  };
}
