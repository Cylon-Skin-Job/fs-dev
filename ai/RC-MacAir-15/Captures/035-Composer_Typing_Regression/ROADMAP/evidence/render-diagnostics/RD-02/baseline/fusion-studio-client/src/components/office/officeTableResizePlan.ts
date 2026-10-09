/**
 * Pure layout-pixel planning for Office table column resize gestures.
 *
 * This module intentionally knows nothing about DOM geometry, ProseMirror, or
 * frontmatter. Callers sample those inputs once and apply a returned plan at
 * the appropriate preview/commit boundary.
 */

export type OfficeTableHorizontalRect = {
  left: number;
  right: number;
};

export type OfficeTableAlignment = 'left' | 'center' | 'right';

type OfficeTableResizeInputBase = {
  columns: readonly number[];
  startClientX: number;
  clientX: number;
  scale: number;
  minimum: number;
  tableRect: OfficeTableHorizontalRect;
};

export type OfficeTableResizeInput = OfficeTableResizeInputBase & (
  | {
    boundary: { kind: 'internal'; index: number };
  }
  | {
    boundary: { kind: 'left-outer' | 'right-outer' };
    alignment: OfficeTableAlignment;
  }
);

export type OfficeTableResizePlan = {
  columns: number[];
  clientDelta: number;
  layoutDelta: number;
  rawDelta: number;
  effectiveDelta: number;
  changedIndexes: number[];
  tableWidth: number;
  previewRect: OfficeTableHorizontalRect;
  guideRect: OfficeTableHorizontalRect;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidRect(rect: OfficeTableHorizontalRect): boolean {
  return isFiniteNumber(rect.left)
    && isFiniteNumber(rect.right)
    && rect.right > rect.left;
}

function isAlignment(value: unknown): value is OfficeTableAlignment {
  return value === 'left' || value === 'center' || value === 'right';
}

function zeroWidthRect(x: number): OfficeTableHorizontalRect {
  return { left: x, right: x };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/**
 * Returns no plan when a drag-start sample is invalid or cannot satisfy the
 * minimum-width invariant. A valid zero-delta gesture returns an unchanged
 * plan with no changed indexes so runtime callers can treat it as a no-op.
 */
export function planOfficeTableResize(input: OfficeTableResizeInput): OfficeTableResizePlan | null {
  const { columns, startClientX, clientX, scale, minimum, tableRect, boundary } = input;
  if (
    columns.length === 0
    || !isFiniteNumber(startClientX)
    || !isFiniteNumber(clientX)
    || !isFiniteNumber(scale)
    || scale <= 0
    || !Number.isSafeInteger(minimum)
    || minimum <= 0
    || !isValidRect(tableRect)
    || columns.some((width) => !Number.isSafeInteger(width) || width < minimum)
  ) {
    return null;
  }

  const startingTableWidth = sum(columns);
  const clientDelta = clientX - startClientX;
  const layoutDelta = clientDelta / scale;
  if (!Number.isFinite(startingTableWidth) || !Number.isFinite(clientDelta) || !Number.isFinite(layoutDelta)) {
    return null;
  }

  const signedLayoutDelta = boundary.kind === 'left-outer' ? -layoutDelta : layoutDelta;
  const roundedDelta = Math.round(signedLayoutDelta);
  if (!Number.isSafeInteger(roundedDelta)) return null;
  const rawDelta = roundedDelta === 0 ? 0 : roundedDelta;
  const nextColumns = [...columns];
  let effectiveDelta: number;
  let guideX: number;
  let previewRect: OfficeTableHorizontalRect;
  let changedIndexes: number[];

  if (boundary.kind === 'internal') {
    const index = boundary.index;
    if (!Number.isSafeInteger(index) || index <= 0 || index >= columns.length) return null;

    const left = columns[index - 1];
    const right = columns[index];
    const lowerBound = minimum - left;
    const upperBound = right - minimum;
    if (lowerBound > upperBound) return null;

    effectiveDelta = Math.min(upperBound, Math.max(lowerBound, rawDelta));
    nextColumns[index - 1] = left + effectiveDelta;
    nextColumns[index] = right - effectiveDelta;
    guideX = tableRect.left + (sum(columns.slice(0, index)) + effectiveDelta) * scale;
    previewRect = { ...tableRect };
    changedIndexes = effectiveDelta === 0 ? [] : [index - 1, index];
  } else {
    if (!('alignment' in input) || !isAlignment(input.alignment)) return null;

    const outerIndex = boundary.kind === 'left-outer' ? 0 : columns.length - 1;
    effectiveDelta = Math.max(rawDelta, minimum - columns[outerIndex]);
    nextColumns[outerIndex] = columns[outerIndex] + effectiveDelta;
    const q = effectiveDelta * scale;
    if (input.alignment === 'left') {
      previewRect = { left: tableRect.left, right: tableRect.right + q };
    } else if (input.alignment === 'right') {
      previewRect = { left: tableRect.left - q, right: tableRect.right };
    } else {
      previewRect = { left: tableRect.left - q / 2, right: tableRect.right + q / 2 };
    }
    guideX = boundary.kind === 'left-outer' ? previewRect.left : previewRect.right;
    changedIndexes = effectiveDelta === 0 ? [] : [outerIndex];
  }

  const tableWidth = sum(nextColumns);
  if (
    !Number.isSafeInteger(effectiveDelta)
    || !Number.isSafeInteger(tableWidth)
    || !Number.isFinite(guideX)
    || !isValidRect(previewRect)
    || nextColumns.some((width) => !Number.isSafeInteger(width) || width < minimum)
  ) {
    return null;
  }

  return {
    columns: nextColumns,
    clientDelta,
    layoutDelta,
    rawDelta,
    effectiveDelta,
    changedIndexes,
    tableWidth,
    previewRect,
    guideRect: zeroWidthRect(guideX),
  };
}
