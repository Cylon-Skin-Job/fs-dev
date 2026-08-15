export type OfficeTableColorDimensions = {
  rowCount: number;
  columnCount: number;
};

export type OfficeTableColorValue = string | 'none';

export type OfficeTableColorBandRule = {
  color: string;
  rank: number;
};

export type OfficeTableColorRules = {
  cells?: Record<string, OfficeTableColorValue>;
  rows?: Record<string, OfficeTableColorBandRule>;
  columns?: Record<string, OfficeTableColorBandRule>;
};

export type OfficeTableColorRulesInput = {
  readonly cells?: unknown;
  readonly rows?: unknown;
  readonly columns?: unknown;
};

export type OfficeTableColorAction =
  | {
    target: 'cell';
    rowIndex: number;
    columnIndex: number;
    value: OfficeTableColorValue;
  }
  | { target: 'row'; index: number; value: OfficeTableColorValue }
  | { target: 'column'; index: number; value: OfficeTableColorValue };

export type OfficeTableColorStructuralChange = {
  axis: 'row' | 'column';
  kind: 'insert' | 'delete';
  index: number;
  nextDimensions: OfficeTableColorDimensions;
};

const CANONICAL_INDEX = /^(0|[1-9]\d*)$/;
const CANONICAL_CELL = /^(0|[1-9]\d*),(0|[1-9]\d*)$/;

// MAX_SAFE_INTEGER itself cannot produce another safe sequence value. Keep the
// persisted domain below that endpoint so every accepted maximum has an exact,
// strictly greater integer successor.
function isCanonicalRank(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value < Number.MAX_SAFE_INTEGER;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : null;
}

function validDimensions(dimensions: OfficeTableColorDimensions): boolean {
  return Number.isInteger(dimensions.rowCount) && dimensions.rowCount >= 0
    && Number.isInteger(dimensions.columnCount) && dimensions.columnCount >= 0;
}

function normalizeCells(
  value: unknown,
  dimensions: OfficeTableColorDimensions,
): Record<string, OfficeTableColorValue> | undefined {
  if (!isRecord(value)) return undefined;
  const cells: Record<string, OfficeTableColorValue> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const match = CANONICAL_CELL.exec(key);
    if (!match) continue;
    const rowIndex = Number(match[1]);
    const columnIndex = Number(match[2]);
    if (rowIndex >= dimensions.rowCount || columnIndex >= dimensions.columnCount) continue;
    const color = normalizedHex(rawValue);
    if (color) cells[key] = color;
    else if (rawValue === 'none') cells[key] = 'none';
  }
  return Object.keys(cells).length > 0 ? cells : undefined;
}

function normalizeBands(
  value: unknown,
  limit: number,
): Record<string, OfficeTableColorBandRule> | undefined {
  if (!isRecord(value)) return undefined;
  const bands: Record<string, OfficeTableColorBandRule> = {};
  for (const [key, rawRule] of Object.entries(value)) {
    if (!CANONICAL_INDEX.test(key) || Number(key) >= limit || !isRecord(rawRule)) continue;
    const color = normalizedHex(rawRule.color);
    const rank = rawRule.rank === undefined ? 0 : rawRule.rank;
    if (!color || !isCanonicalRank(rank)) continue;
    bands[key] = { color, rank };
  }
  return Object.keys(bands).length > 0 ? bands : undefined;
}

function cloneRules(rules: OfficeTableColorRules): OfficeTableColorRules {
  return {
    ...(rules.cells ? { cells: { ...rules.cells } } : {}),
    ...(rules.rows ? {
      rows: Object.fromEntries(Object.entries(rules.rows).map(([key, rule]) => [key, { ...rule }])),
    } : {}),
    ...(rules.columns ? {
      columns: Object.fromEntries(
        Object.entries(rules.columns).map(([key, rule]) => [key, { ...rule }]),
      ),
    } : {}),
  };
}

function pruneEmptyMaps(rules: OfficeTableColorRules): OfficeTableColorRules {
  const next = cloneRules(rules);
  if (next.cells && Object.keys(next.cells).length === 0) delete next.cells;
  if (next.rows && Object.keys(next.rows).length === 0) delete next.rows;
  if (next.columns && Object.keys(next.columns).length === 0) delete next.columns;
  return next;
}

function maxRank(rules: OfficeTableColorRules): number {
  const ranks = [
    ...Object.values(rules.rows ?? {}).map(({ rank }) => rank),
    ...Object.values(rules.columns ?? {}).map(({ rank }) => rank),
  ];
  return ranks.length > 0 ? Math.max(...ranks) : 0;
}

function ensureRankCapacity(rules: OfficeTableColorRules): OfficeTableColorRules {
  if (isCanonicalRank(maxRank(rules) + 1)) return rules;

  // A valid rank immediately below the reserved endpoint has no canonical
  // successor. Compact only at that exhaustion boundary, preserving every
  // ordering and equal-rank tie, so the next action still has a canonical
  // strictly newer sequence value. The metadata Step keeps this byte-exactly
  // undoable with the rest of the target-table hygiene.
  const orderedRanks = Array.from(new Set([
    ...Object.values(rules.rows ?? {}).map(({ rank }) => rank),
    ...Object.values(rules.columns ?? {}).map(({ rank }) => rank),
  ])).sort((left, right) => left - right);
  const compactedRanks = new Map<number, number>([[0, 0]]);
  orderedRanks.filter((rank) => rank > 0).forEach((rank, index) => {
    compactedRanks.set(rank, index + 1);
  });
  const compact = (bands: Record<string, OfficeTableColorBandRule> | undefined) => (
    bands
      ? Object.fromEntries(Object.entries(bands).map(([key, rule]) => [key, {
        color: rule.color,
        rank: compactedRanks.get(rule.rank) ?? 0,
      }]))
      : undefined
  );
  return pruneEmptyMaps({
    ...(rules.cells ? { cells: { ...rules.cells } } : {}),
    ...(rules.rows ? { rows: compact(rules.rows) } : {}),
    ...(rules.columns ? { columns: compact(rules.columns) } : {}),
  });
}

function resolvedBand(
  rules: OfficeTableColorRules,
  rowIndex: number,
  columnIndex: number,
): { axis: 'row' | 'column'; rule: OfficeTableColorBandRule } | null {
  const row = rules.rows?.[String(rowIndex)];
  const column = rules.columns?.[String(columnIndex)];
  if (row && column) return row.rank >= column.rank
    ? { axis: 'row', rule: row }
    : { axis: 'column', rule: column };
  if (row) return { axis: 'row', rule: row };
  if (column) return { axis: 'column', rule: column };
  return null;
}

function resolvedColor(
  rules: OfficeTableColorRules,
  rowIndex: number,
  columnIndex: number,
): string | null {
  const explicit = rules.cells?.[`${rowIndex},${columnIndex}`];
  if (explicit) return explicit === 'none' ? null : explicit;
  return resolvedBand(rules, rowIndex, columnIndex)?.rule.color ?? null;
}

function isValidAction(
  action: OfficeTableColorAction,
  dimensions: OfficeTableColorDimensions,
): boolean {
  const validValue = action.value === 'none' || Boolean(normalizedHex(action.value));
  if (!validValue) return false;
  if (action.target === 'cell') return Number.isInteger(action.rowIndex)
    && action.rowIndex >= 0 && action.rowIndex < dimensions.rowCount
    && Number.isInteger(action.columnIndex)
    && action.columnIndex >= 0 && action.columnIndex < dimensions.columnCount;
  const limit = action.target === 'row' ? dimensions.rowCount : dimensions.columnCount;
  return Number.isInteger(action.index) && action.index >= 0 && action.index < limit;
}

function deleteCellsInBand(
  cells: Record<string, OfficeTableColorValue> | undefined,
  axis: 'row' | 'column',
  index: number,
): Record<string, OfficeTableColorValue> | undefined {
  if (!cells) return undefined;
  const next: Record<string, OfficeTableColorValue> = {};
  for (const [key, value] of Object.entries(cells)) {
    const match = CANONICAL_CELL.exec(key);
    if (!match) continue;
    const coordinate = axis === 'row' ? Number(match[1]) : Number(match[2]);
    if (coordinate !== index) next[key] = value;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function rerankMatchingLosingBand(
  rules: OfficeTableColorRules,
  rowIndex: number,
  columnIndex: number,
  color: string,
  dimensions: OfficeTableColorDimensions,
): OfficeTableColorRules | null {
  const row = rules.rows?.[String(rowIndex)];
  const column = rules.columns?.[String(columnIndex)];
  const winner = resolvedBand(rules, rowIndex, columnIndex);
  if (winner?.rule.color === color) {
    const next = cloneRules(rules);
    if (next.cells) delete next.cells[`${rowIndex},${columnIndex}`];
    return pruneEmptyMaps(next);
  }

  const candidate = row?.color === color
    ? { axis: 'row' as const, index: rowIndex }
    : column?.color === color
      ? { axis: 'column' as const, index: columnIndex }
      : null;
  if (!candidate) return null;

  const reranked = cloneRules(ensureRankCapacity(rules));
  const map = candidate.axis === 'row' ? reranked.rows : reranked.columns;
  const rule = map?.[String(candidate.index)];
  if (!rule) return null;
  map![String(candidate.index)] = { color: rule.color, rank: maxRank(reranked) + 1 };
  if (reranked.cells) delete reranked.cells[`${rowIndex},${columnIndex}`];

  for (let rowToCompare = 0; rowToCompare < dimensions.rowCount; rowToCompare += 1) {
    for (let columnToCompare = 0;
      columnToCompare < dimensions.columnCount;
      columnToCompare += 1) {
      if (rowToCompare === rowIndex && columnToCompare === columnIndex) continue;
      if (resolvedColor(rules, rowToCompare, columnToCompare)
        !== resolvedColor(reranked, rowToCompare, columnToCompare)) return null;
    }
  }
  return pruneEmptyMaps(reranked);
}

function shiftIndex(index: number, change: OfficeTableColorStructuralChange): number | null {
  if (change.kind === 'insert') return index >= change.index ? index + 1 : index;
  if (index === change.index) return null;
  return index > change.index ? index - 1 : index;
}

function reindexCells(
  value: unknown,
  change: OfficeTableColorStructuralChange,
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const cells: Record<string, unknown> = {};
  for (const [key, cellValue] of Object.entries(value)) {
    const match = CANONICAL_CELL.exec(key);
    if (!match) continue;
    const rowIndex = Number(match[1]);
    const columnIndex = Number(match[2]);
    const nextRow = change.axis === 'row' ? shiftIndex(rowIndex, change) : rowIndex;
    const nextColumn = change.axis === 'column' ? shiftIndex(columnIndex, change) : columnIndex;
    if (nextRow !== null && nextColumn !== null) cells[`${nextRow},${nextColumn}`] = cellValue;
  }
  return Object.keys(cells).length > 0 ? cells : undefined;
}

function reindexBands(
  value: unknown,
  change: OfficeTableColorStructuralChange,
  axis: 'row' | 'column',
): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const bands: Record<string, unknown> = {};
  for (const [key, rule] of Object.entries(value)) {
    if (!CANONICAL_INDEX.test(key)) continue;
    const index = Number(key);
    const nextIndex = change.axis === axis ? shiftIndex(index, change) : index;
    if (nextIndex !== null) bands[String(nextIndex)] = rule;
  }
  return Object.keys(bands).length > 0 ? bands : undefined;
}

/** Apply S1-S5 and S10 after the mandatory S7/S8 normalization pass. */
export function applyColorPolicy(
  currentRules: OfficeTableColorRulesInput,
  action: OfficeTableColorAction,
  dimensions: OfficeTableColorDimensions,
): OfficeTableColorRules {
  const rules = normalizeColorRules(currentRules, dimensions);
  if (!validDimensions(dimensions) || !isValidAction(action, dimensions)) return rules;
  const value = action.value === 'none' ? 'none' : normalizedHex(action.value)!;

  if (action.target === 'cell') {
    const key = `${action.rowIndex},${action.columnIndex}`;
    const next = cloneRules(rules);
    if (value === 'none') {
      if (resolvedBand(rules, action.rowIndex, action.columnIndex)) {
        next.cells = { ...(next.cells ?? {}), [key]: 'none' };
      } else if (next.cells) delete next.cells[key];
      return pruneEmptyMaps(next);
    }
    const tidy = rerankMatchingLosingBand(
      rules,
      action.rowIndex,
      action.columnIndex,
      value,
      dimensions,
    );
    if (tidy) return tidy;
    next.cells = { ...(next.cells ?? {}), [key]: value };
    return pruneEmptyMaps(next);
  }

  const axis = action.target;
  const mapKey = axis === 'row' ? 'rows' : 'columns';
  const perpendicularKey = axis === 'row' ? 'columns' : 'rows';
  const paintRules = value === 'none' ? rules : ensureRankCapacity(rules);
  const next = cloneRules(paintRules);
  next.cells = deleteCellsInBand(next.cells, axis, action.index);
  const map = { ...(next[mapKey] ?? {}) };
  if (value !== 'none') {
    map[String(action.index)] = { color: value, rank: maxRank(paintRules) + 1 };
  } else {
    delete map[String(action.index)];
    const perpendicular = next[perpendicularKey];
    for (const key of Object.keys(perpendicular ?? {})) {
      const cellKey = axis === 'row'
        ? `${action.index},${key}`
        : `${key},${action.index}`;
      next.cells = { ...(next.cells ?? {}), [cellKey]: 'none' };
    }
  }
  next[mapKey] = map;
  return pruneEmptyMaps(next);
}

/** Normalize malformed target-table rules and explicitly repair rankless legacy bands to rank 0. */
export function normalizeColorRules(
  currentRules: OfficeTableColorRulesInput,
  dimensions: OfficeTableColorDimensions,
): OfficeTableColorRules {
  if (!validDimensions(dimensions)) return {};
  const cells = normalizeCells(currentRules?.cells, dimensions);
  const rows = normalizeBands(currentRules?.rows, dimensions.rowCount);
  const columns = normalizeBands(currentRules?.columns, dimensions.columnCount);
  return {
    ...(cells ? { cells } : {}),
    ...(rows ? { rows } : {}),
    ...(columns ? { columns } : {}),
  };
}

/** Reindex exact structural coordinates first, then run S7/S8 hygiene against next dimensions. */
export function reindexColorRules(
  currentRules: OfficeTableColorRulesInput,
  structuralChange: OfficeTableColorStructuralChange,
): OfficeTableColorRules {
  const shifted: OfficeTableColorRulesInput = {
    cells: reindexCells(currentRules?.cells, structuralChange),
    rows: reindexBands(currentRules?.rows, structuralChange, 'row'),
    columns: reindexBands(currentRules?.columns, structuralChange, 'column'),
  };
  return normalizeColorRules(shifted, structuralChange.nextDimensions);
}
