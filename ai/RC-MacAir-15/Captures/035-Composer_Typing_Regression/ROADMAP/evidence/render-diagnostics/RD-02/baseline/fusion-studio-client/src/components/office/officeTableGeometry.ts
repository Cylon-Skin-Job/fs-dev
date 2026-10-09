/**
 * @module officeTableGeometry
 * @role Office-owned column-width controls for document tables.
 *
 *       Column resize handles live in an overlay appended to <body>, positioned
 *       over each logical table boundary. Dragging a handle moves
 *       only a dashed guide line — it never touches ProseMirror's DOM. The real
 *       column width is written to the table's <colgroup> exactly once, on
 *       release, then persisted to Markdown frontmatter under `metadata.tables`.
 *
 *       Row heights are intentionally NOT managed: rows size to their content.
 */
import {
  cloneOfficeTableRawValue,
  type DocumentTableLayout,
} from '../../lib/front-matter';
import {
  findStructureTableIdentityEntry,
  fingerprintDomTable,
  getDomTableLogicalWidth,
  getOfficeTables,
  type OfficeTableIdentity,
} from './officeTableIdentity';
import {
  registerOfficeTableMetadataBindings,
  snapshotsEqual,
  type OfficeTableMetadataActionResult,
  type OfficeTableMetadataSnapshot,
} from './officeTableHistory';
import {
  planOfficeTableLogicalBoundaries,
  type OfficeTableLogicalBoundaryPlan,
} from './officeTableNodeView';
import {
  planOfficeTableResize,
  type OfficeTableAlignment,
  type OfficeTableResizePlan,
} from './officeTableResizePlan';

export type OfficeTableGeometryController = {
  applyLayouts: () => void;
  readLayouts: () => unknown | null;
  cleanup: () => void;
};

const OVERLAY_CLASS = 'rv-office-table-overlay';
const GRAB_CLASS = 'rv-office-col-grab';
const HOVER_MARGIN = 24; // px above the table that still counts as "hovering it"
const EDGE_SLACK = 8; // px of horizontal slop around the table for the hot zone

type DragState = {
  table: HTMLTableElement;
  captureTarget: HTMLElement;
  pointerId: number;
  handleIndex: number;
  boundary: OfficeTableLogicalBoundaryPlan;
  startClientX: number;
  startWidths: number[]; // layout px at drag start
  tableRect: { left: number; right: number };
  minLayout: number; // minimum column width in layout px
  scale: number; // viewport px per layout px (accounts for editor zoom)
  alignment: OfficeTableAlignment; // effective table placement frozen at drag start
  identity: OfficeTableIdentity; // target identity frozen for release-time revalidation
};

export type OfficeTableGeometryMetadataDispatch = (
  prepare: (before: OfficeTableMetadataSnapshot) => OfficeTableMetadataSnapshot | null,
) => OfficeTableMetadataActionResult;

export type ResolveOfficeTableGeometryAlignment = (
  table: HTMLTableElement,
) => OfficeTableAlignment;

export type OfficeTableSquareMinimumInputs = {
  computedMinHeight: number;
  usedLineHeight: number;
  paddingBlockStart: number;
  paddingBlockEnd: number;
  presentationStroke: number;
};

/**
 * Pure square-minimum formula. Presentation paint is validated as an input so
 * callers/tests can model current and future strokes, but is deliberately not
 * part of the result: Office table paint is inset and layout-neutral.
 */
export function deriveOfficeTableSquareMinimum({
  computedMinHeight,
  usedLineHeight,
  paddingBlockStart,
  paddingBlockEnd,
  presentationStroke,
}: OfficeTableSquareMinimumInputs): number | null {
  const inputs = [
    computedMinHeight,
    usedLineHeight,
    paddingBlockStart,
    paddingBlockEnd,
    presentationStroke,
  ];
  if (
    inputs.some((value) => !Number.isFinite(value) || value < 0)
    || usedLineHeight <= 0
  ) return null;
  const minimum = Math.ceil(Math.max(
    computedMinHeight,
    usedLineHeight + paddingBlockStart + paddingBlockEnd,
  ));
  return Number.isSafeInteger(minimum) && minimum > 0 ? minimum : null;
}

function pixelValue(value: string): number | null {
  const match = /^(-?(?:\d+|\d*\.\d+))px$/i.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function copyProbeTypography(source: CSSStyleDeclaration, target: CSSStyleDeclaration): void {
  for (const property of [
    'font-family',
    'font-size',
    'font-stretch',
    'font-style',
    'font-variant',
    'font-weight',
    'letter-spacing',
    'text-transform',
    'word-spacing',
    'writing-mode',
  ]) {
    target.setProperty(property, source.getPropertyValue(property));
  }
}

/** Measure a used value outside ProseMirror's editable DOM. */
function measureWithOfficeProbe(
  source: CSSStyleDeclaration,
  configure: (probe: HTMLDivElement) => void,
): number | null {
  const probe = document.createElement('div');
  probe.className = 'rv-office-table-measure-probe';
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: 'max-content',
    visibility: 'hidden',
    pointerEvents: 'none',
    contain: 'layout style paint',
    whiteSpace: 'pre',
    margin: '0',
    border: '0',
  });
  copyProbeTypography(source, probe.style);
  configure(probe);
  document.body.appendChild(probe);
  const measured = probe.getBoundingClientRect().height;
  probe.remove();
  return Number.isFinite(measured) && measured >= 0 ? measured : null;
}

function resolveUsedLineHeight(style: CSSStyleDeclaration): number | null {
  const pixels = pixelValue(style.lineHeight);
  if (pixels !== null) return pixels;
  return measureWithOfficeProbe(style, (probe) => {
    probe.style.lineHeight = style.lineHeight;
    probe.style.padding = '0';
    probe.style.minHeight = '0';
    probe.style.boxSizing = 'content-box';
    probe.textContent = 'M';
  });
}

function resolveUsedMinHeight(style: CSSStyleDeclaration): number | null {
  const pixels = pixelValue(style.minHeight);
  if (pixels !== null) return pixels;
  if (style.minHeight === 'auto' || style.minHeight === 'none') return 0;
  return measureWithOfficeProbe(style, (probe) => {
    probe.style.lineHeight = '0';
    probe.style.padding = '0';
    probe.style.minHeight = style.minHeight;
    probe.style.boxSizing = style.boxSizing;
    probe.textContent = '';
  });
}

function cloneLayouts<T>(layouts: T): T {
  return cloneOfficeTableRawValue(layouts);
}

function finiteWidth(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function getScrollParent(element: HTMLElement): HTMLElement | null {
  let node: HTMLElement | null = element.parentElement;
  while (node) {
    const { overflow, overflowY } = window.getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowY) || /(auto|scroll|overlay)/.test(overflow)) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

function firstRegularCellInFirstDataRow(table: HTMLTableElement): HTMLTableCellElement | null {
  for (const row of Array.from(table.rows)) {
    const firstPhysicalCell = row.cells.item(0);
    if (firstPhysicalCell?.tagName === 'TD') return firstPhysicalCell;
  }
  return null;
}

export function resolveOfficeTableSquareMinimum(table: HTMLTableElement): number | null {
  const cell = firstRegularCellInFirstDataRow(table);
  if (!cell) return null;
  const style = window.getComputedStyle(cell);
  const computedMinHeight = resolveUsedMinHeight(style);
  const usedLineHeight = resolveUsedLineHeight(style);
  const paddingBlockStart = pixelValue(style.paddingBlockStart);
  const paddingBlockEnd = pixelValue(style.paddingBlockEnd);
  if (
    computedMinHeight === null
    || usedLineHeight === null
    || paddingBlockStart === null
    || paddingBlockEnd === null
  ) return null;
  return deriveOfficeTableSquareMinimum({
    computedMinHeight,
    usedLineHeight,
    paddingBlockStart,
    paddingBlockEnd,
    presentationStroke: 1,
  });
}

export function measureOfficeTableLogicalWidths(table: HTMLTableElement): number[] {
  const columnCount = getDomTableLogicalWidth(table);
  if (columnCount === 0) return [];
  const columns = ensureColGroup(table, columnCount);
  const tableRect = table.getBoundingClientRect();
  const scale = table.offsetWidth > 0 ? tableRect.width / table.offsetWidth : 1;
  const fallback = table.offsetWidth > 0 ? table.offsetWidth / columnCount : 1;
  return columns.map((column) => {
    const viewportWidth = column.getBoundingClientRect().width;
    const layoutWidth = viewportWidth > 0 ? viewportWidth / (scale || 1) : fallback;
    return Math.max(1, Math.round(layoutWidth));
  });
}

function ensureColGroup(table: HTMLTableElement, columnCount: number): HTMLTableColElement[] {
  let colgroup = table.querySelector<HTMLTableColElement>('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  while (colgroup.children.length < columnCount) {
    colgroup.appendChild(document.createElement('col'));
  }
  while (colgroup.children.length > columnCount) {
    colgroup.lastElementChild?.remove();
  }
  return Array.from(colgroup.children) as HTMLTableColElement[];
}

function applyColumnWidths(table: HTMLTableElement, widths: number[], minSize: number): void {
  if (widths.length === 0) return;
  const columns = widths.map((width) => Math.max(minSize, Math.round(width)));
  const colElements = ensureColGroup(table, columns.length);
  colElements.forEach((col, index) => {
    col.style.width = `${columns[index]}px`;
  });
  const tableWidth = columns.reduce((sum, width) => sum + width, 0);
  table.style.tableLayout = 'fixed';
  table.style.width = `${tableWidth}px`;
  table.style.minWidth = `${tableWidth}px`;
  table.style.setProperty('--rv-office-table-cell-min-width', `${minSize}px`);
  table.style.setProperty('--rv-office-table-cell-min-height', `${minSize}px`);
}

function clearColumnWidths(table: HTMLTableElement): void {
  table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col').forEach((column) => {
    column.style.removeProperty('width');
  });
  table.style.removeProperty('table-layout');
  table.style.removeProperty('width');
  table.style.removeProperty('min-width');
  table.style.removeProperty('--rv-office-table-cell-min-width');
  table.style.removeProperty('--rv-office-table-cell-min-height');
}

function layoutForTable(
  layouts: unknown,
  identity: OfficeTableIdentity,
  liveTables: readonly OfficeTableIdentity[],
): DocumentTableLayout | null {
  return findStructureTableIdentityEntry(layouts, identity, liveTables) ?? null;
}

export function prepareOfficeTableResizeSnapshot(
  before: OfficeTableMetadataSnapshot,
  identity: OfficeTableIdentity,
  columns: readonly number[],
  liveTables: readonly OfficeTableIdentity[] = [identity],
): OfficeTableMetadataSnapshot | null {
  if (!columns.length || !columns.every(finiteWidth)) return null;
  const normalizedColumns = columns.map((width) => Math.round(width));
  if (!normalizedColumns.every(finiteWidth)) return null;
  const rawLayouts = Array.isArray(before.tables) ? before.tables : [];
  const tables = cloneLayouts(rawLayouts);
  const existing = findStructureTableIdentityEntry<DocumentTableLayout>(
    rawLayouts,
    identity,
    liveTables,
  );
  const updated: DocumentTableLayout = {
    ...(existing ? cloneLayouts(existing) : {}),
    ...identity,
    columns: normalizedColumns,
  };
  if (existing) tables[rawLayouts.indexOf(existing)] = updated;
  else tables.push(updated);
  const after = {
    tables,
    tableColors: cloneLayouts(before.tableColors),
    ...(Object.hasOwn(before, 'tableStyles')
      ? { tableStyles: cloneLayouts(before.tableStyles) }
      : {}),
  };
  return snapshotsEqual(before, after) ? null : after;
}

export function installOfficeTableGeometry(
  root: HTMLElement,
  initialLayouts: unknown,
  dispatchMetadataAction?: OfficeTableGeometryMetadataDispatch,
  resolveAlignment: ResolveOfficeTableGeometryAlignment = () => 'left',
): OfficeTableGeometryController {
  let currentLayouts = cloneLayouts(initialLayouts);
  let shouldPersistLayouts = !Array.isArray(initialLayouts) || initialLayouts.length > 0;
  let activeTable: HTMLTableElement | null = null;
  let dragState: DragState | null = null;
  let refreshFrame = 0;
  let lastPointer: { clientX: number; clientY: number } | null = null;

  const scrollTarget: HTMLElement | Window = getScrollParent(root) ?? window;

  // Overlay lives on <body> so it is never part of ProseMirror's editable DOM.
  // Each handle is a thin full-height strip sitting on a column line: you point
  // at the line (↔ cursor) and drag it directly; a dashed guide lights up on
  // hover/drag.
  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  document.body.appendChild(overlay);
  const handles: HTMLDivElement[] = [];

  // Reading for an ordinary text/settings save must not materialize dormant or
  // malformed width slots. Only an explicit resize/structure commit cleans it.
  const readLayouts = () => (shouldPersistLayouts ? cloneLayouts(currentLayouts) : null);

  const applyLayouts = () => {
    const tables = getOfficeTables(root);
    const liveTables = tables.map((table, tableIndex) => ({
      tableIndex,
      fingerprint: fingerprintDomTable(table),
    }));
    tables.forEach((table, tableIndex) => {
      const layout = layoutForTable(currentLayouts, liveTables[tableIndex], liveTables);
      if (!layout || !Array.isArray(layout.columns)) {
        clearColumnWidths(table);
        return;
      }
      const storedColumns = layout.columns;
      const minSize = resolveOfficeTableSquareMinimum(table);
      if (minSize === null) {
        clearColumnWidths(table);
        return;
      }
      const measured = measureOfficeTableLogicalWidths(table);
      const logicalCount = getDomTableLogicalWidth(table);
      const widths = Array.from(
        { length: logicalCount },
        (_, index) => finiteWidth(storedColumns[index])
          ? storedColumns[index]
          : finiteWidth(measured[index]) ? measured[index] : 1,
      );
      applyColumnWidths(table, widths, minSize);
    });
    if (activeTable?.isConnected) {
      positionOverlay(activeTable);
    } else if (lastPointer) {
      const replacement = tableAtHotZone(lastPointer.clientX, lastPointer.clientY);
      if (replacement) showOverlayFor(replacement);
      else hideOverlay();
    }
  };

  const scheduleRefresh = () => {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      if (dragState && !dragState.table.isConnected) cancelDrag();
      applyLayouts();
    });
  };

  // ── Overlay rendering ────────────────────────────────────────────────
  const reconcileHandles = (plans: readonly OfficeTableLogicalBoundaryPlan[]) => {
    while (handles.length < plans.length) {
      const handle = document.createElement('div');
      handle.className = GRAB_CLASS;
      handle.addEventListener('pointerdown', onHandleDown);
      handle.addEventListener('lostpointercapture', onLostPointerCapture);
      overlay.appendChild(handle);
      handles.push(handle);
    }
    while (handles.length > plans.length) {
      handles.pop()?.remove();
    }
    plans.forEach((plan, index) => {
      const handle = handles[index];
      handle.dataset.boundaryKind = plan.kind;
      handle.dataset.boundaryIndex = String(plan.index);
    });
  };

  function positionOverlay(table: HTMLTableElement) {
    const logicalCount = getDomTableLogicalWidth(table);
    if (!table.isConnected || logicalCount === 0) {
      hideOverlay();
      return;
    }
    const rect = table.getBoundingClientRect();
    const columns = ensureColGroup(table, logicalCount);
    const columnRects = columns.map((column) => column.getBoundingClientRect());
    const plans = planOfficeTableLogicalBoundaries(logicalCount);
    const boundaryXs = plans.map((plan) => {
      if (plan.kind === 'left-outer') return rect.left;
      if (plan.kind === 'right-outer') return rect.right;
      const previousColumn = columnRects[plan.index - 1];
      return previousColumn?.width > 0 ? previousColumn.right : rect.left;
    });
    reconcileHandles(plans);
    plans.forEach((_, index) => {
      const handle = handles[index];
      handle.style.left = `${boundaryXs[index]}px`;
      handle.style.top = `${rect.top}px`;
      handle.style.height = `${rect.height}px`;
      handle.style.display = 'block';
    });
  }

  const showOverlayFor = (table: HTMLTableElement) => {
    activeTable = table;
    positionOverlay(table);
  };

  function hideOverlay() {
    if (dragState) return;
    activeTable = null;
    handles.forEach((handle) => { handle.style.display = 'none'; handle.dataset.active = 'false'; });
  }

  function tableAtHotZone(clientX: number, clientY: number): HTMLTableElement | null {
    for (const table of getOfficeTables(root)) {
      const rect = table.getBoundingClientRect();
      const within = clientX >= rect.left - EDGE_SLACK
        && clientX <= rect.right + EDGE_SLACK
        && clientY >= rect.top - HOVER_MARGIN
        && clientY <= rect.bottom + EDGE_SLACK;
      if (within) return table;
    }
    return null;
  }

  // ── Hover ────────────────────────────────────────────────────────────
  const onDocPointerMove = (event: PointerEvent) => {
    if (dragState) return;
    lastPointer = { clientX: event.clientX, clientY: event.clientY };
    const table = tableAtHotZone(event.clientX, event.clientY);
    if (table) showOverlayFor(table);
    else hideOverlay();
  };

  // ── Drag (moves only the overlay line; the table is written on release) ─
  function onHandleDown(event: PointerEvent) {
    if (event.button !== 0 || !activeTable) return;
    const handle = event.currentTarget as HTMLElement;
    const handleIndex = Number(handle.dataset.boundaryIndex);
    const kind = handle.dataset.boundaryKind;
    const table = activeTable;
    const startWidths = measureOfficeTableLogicalWidths(table);
    if (
      !Number.isSafeInteger(handleIndex)
      || handleIndex < 0
      || handleIndex > startWidths.length
      || (kind !== 'left-outer' && kind !== 'internal' && kind !== 'right-outer')
    ) return;
    const boundary: OfficeTableLogicalBoundaryPlan = kind === 'internal'
      ? { kind, index: handleIndex }
      : kind === 'left-outer'
        ? { kind, index: 0 }
        : { kind, index: startWidths.length };
    const rect = table.getBoundingClientRect();
    if (table.offsetWidth <= 0) return;
    const scale = rect.width / table.offsetWidth;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const minLayout = resolveOfficeTableSquareMinimum(table);
    if (minLayout === null || startWidths.some((width) => width < minLayout)) return;
    const tableIndex = getOfficeTables(root).indexOf(table);
    if (tableIndex < 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragState = {
      table,
      captureTarget: handle,
      pointerId: event.pointerId,
      handleIndex,
      boundary,
      startClientX: event.clientX,
      startWidths,
      tableRect: { left: rect.left, right: rect.right },
      minLayout,
      scale,
      alignment: resolveAlignment(table),
      identity: { tableIndex, fingerprint: fingerprintDomTable(table) },
    };
    try { handle.setPointerCapture(event.pointerId); } catch { /* not capturable */ }
    handle.dataset.active = 'true';
    document.body.classList.add('rv-office-col-resizing');
  }

  const resizePlanForClient = (clientX: number): OfficeTableResizePlan | null => {
    if (!dragState) return null;
    const input = {
      columns: dragState.startWidths,
      startClientX: dragState.startClientX,
      clientX,
      scale: dragState.scale,
      minimum: dragState.minLayout,
      tableRect: dragState.tableRect,
    };
    return dragState.boundary.kind === 'internal'
      ? planOfficeTableResize({
        ...input,
        boundary: { kind: 'internal', index: dragState.boundary.index },
      })
      : planOfficeTableResize({
        ...input,
        boundary: { kind: dragState.boundary.kind },
        alignment: dragState.alignment,
      });
  };

  const onWindowPointerMove = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    const plan = resizePlanForClient(event.clientX);
    const handle = handles[dragState.handleIndex];
    if (handle && plan) handle.style.left = `${plan.guideRect.left}px`;
  };

  function finishDrag(drag: DragState, reconcile = true) {
    dragState = null;
    document.body.classList.remove('rv-office-col-resizing');
    handles.forEach((handle) => { handle.dataset.active = 'false'; });
    try {
      if (drag.captureTarget.hasPointerCapture(drag.pointerId)) {
        drag.captureTarget.releasePointerCapture(drag.pointerId);
      }
    } catch { /* capture already lost or unavailable */ }
    if (!reconcile) return;
    if (drag.table.isConnected) showOverlayFor(drag.table);
    else if (lastPointer) {
      const replacement = tableAtHotZone(lastPointer.clientX, lastPointer.clientY);
      if (replacement) showOverlayFor(replacement);
      else hideOverlay();
    } else hideOverlay();
  }

  function cancelDrag() {
    if (!dragState) return;
    finishDrag(dragState);
  }

  const onWindowPointerUp = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    const drag = dragState;
    const plan = drag.table.isConnected ? resizePlanForClient(event.clientX) : null;
    finishDrag(drag);
    if (!plan || plan.effectiveDelta === 0 || !dispatchMetadataAction) return;
    const tables = getOfficeTables(root);
    const tableIndex = tables.indexOf(drag.table);
    if (tableIndex < 0 || !drag.table.isConnected) return;
    const fingerprint = fingerprintDomTable(drag.table);
    if (
      tableIndex !== drag.identity.tableIndex
      || fingerprint !== drag.identity.fingerprint
    ) return;
    const identity = { tableIndex, fingerprint };
    const liveTables = tables.map((table, index) => ({
      tableIndex: index,
      fingerprint: fingerprintDomTable(table),
    }));
    dispatchMetadataAction((before) => (
      prepareOfficeTableResizeSnapshot(before, identity, plan.columns, liveTables)
    ));
  };

  const onWindowPointerCancel = (event: PointerEvent) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    event.preventDefault();
    cancelDrag();
  };

  function onLostPointerCapture(event: PointerEvent) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    cancelDrag();
  }

  const onWindowBlur = () => cancelDrag();

  const onWindowKeyDown = (event: KeyboardEvent) => {
    if (!dragState || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    cancelDrag();
  };

  // ── Keep the overlay aligned as the document scrolls / resizes ────────
  const onScrollOrResize = () => {
    if (dragState) {
      const rect = dragState.table.getBoundingClientRect();
      const handle = handles[dragState.handleIndex];
      if (handle) {
        handle.style.top = `${rect.top}px`;
        handle.style.height = `${rect.height}px`;
      }
    } else if (activeTable) {
      positionOverlay(activeTable);
    }
  };

  // Re-apply saved widths after ProseMirror rebuilds a table (content edits).
  // applyLayouts only writes inline styles, which the node view ignores, so
  // this cannot feed back into a rebuild loop.
  const observer = new MutationObserver(() => scheduleRefresh());
  observer.observe(root, { childList: true, subtree: true });
  const viewportRoot = root.closest<HTMLElement>('.rv-office-document-editor');
  const viewportObserver = viewportRoot ? new MutationObserver(onScrollOrResize) : null;
  viewportObserver?.observe(viewportRoot as HTMLElement, {
    attributes: true,
    attributeFilter: ['class', 'style'],
  });

  document.addEventListener('pointermove', onDocPointerMove, true);
  window.addEventListener('pointermove', onWindowPointerMove, true);
  window.addEventListener('pointerup', onWindowPointerUp, true);
  window.addEventListener('pointercancel', onWindowPointerCancel, true);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('keydown', onWindowKeyDown, true);
  scrollTarget.addEventListener('scroll', onScrollOrResize, true);
  window.addEventListener('resize', onScrollOrResize);

  const unregisterMetadata = registerOfficeTableMetadataBindings(root, {
    readTables: () => cloneLayouts(currentLayouts),
    publishTables: (layouts) => {
      currentLayouts = cloneLayouts(layouts);
      shouldPersistLayouts = !Array.isArray(currentLayouts) || currentLayouts.length > 0;
    },
    renderTables: applyLayouts,
  });

  return {
    applyLayouts,
    readLayouts,
    cleanup: () => {
      unregisterMetadata();
      observer.disconnect();
      viewportObserver?.disconnect();
      document.removeEventListener('pointermove', onDocPointerMove, true);
      window.removeEventListener('pointermove', onWindowPointerMove, true);
      window.removeEventListener('pointerup', onWindowPointerUp, true);
      window.removeEventListener('pointercancel', onWindowPointerCancel, true);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('keydown', onWindowKeyDown, true);
      scrollTarget.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
      if (dragState) finishDrag(dragState, false);
      else document.body.classList.remove('rv-office-col-resizing');
      overlay.remove();
      handles.length = 0;
    },
  };
}
