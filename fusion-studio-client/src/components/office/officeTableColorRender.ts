import type { OfficeTableColorRulesInput } from './officeTableColorPolicy';

export type OfficeTableColorStylesheetCell = {
  rowIndex: number;
  columnIndex: number;
  physicalRowIndex: number;
  physicalColumnIndex: number;
};

export type OfficeTableColorStylesheetTable = {
  tableId: string;
  rules: OfficeTableColorRulesInput;
  cells: readonly OfficeTableColorStylesheetCell[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedHex(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate.toLowerCase() : null;
}

// Mirror the policy's persisted rank domain: zero is canonical, while the
// nonincrementable safe-integer endpoint and all unsafe/fractional values are
// dormant until a target-table mutation prunes them.
function isCanonicalRank(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= 0
    && value < Number.MAX_SAFE_INTEGER;
}

function bandRule(value: unknown): { color: string; rank: number } | null {
  if (!isRecord(value)) return null;
  const color = normalizedHex(value.color);
  const rank = value.rank === undefined ? 0 : value.rank;
  return color && isCanonicalRank(rank)
    ? { color, rank }
    : null;
}

function mapValue(map: unknown, key: string): unknown {
  return isRecord(map) ? map[key] : undefined;
}

/** Resolve the stored color for one row or column band, including legacy rankless rules. */
export function rulesToBandColor(
  rules: OfficeTableColorRulesInput | undefined,
  axis: 'row' | 'column',
  index: number,
): string | null {
  if (!rules || !Number.isInteger(index) || index < 0) return null;
  return bandRule(mapValue(axis === 'row' ? rules.rows : rules.columns, String(index)))?.color
    ?? null;
}

/** Resolve one logical cell without mutating or normalizing its stored rules. */
export function rulesToCellColor(
  rules: OfficeTableColorRulesInput | undefined,
  rowIndex: number,
  columnIndex: number,
): string | null {
  if (!rules || !Number.isInteger(rowIndex) || rowIndex < 0
    || !Number.isInteger(columnIndex) || columnIndex < 0) return null;
  const explicit = mapValue(rules.cells, `${rowIndex},${columnIndex}`);
  if (explicit === 'none') return null;
  const explicitColor = normalizedHex(explicit);
  if (explicitColor) return explicitColor;
  const row = bandRule(mapValue(rules.rows, String(rowIndex)));
  const column = bandRule(mapValue(rules.columns, String(columnIndex)));
  if (row && column) return row.rank >= column.rank ? row.color : column.color;
  return row?.color ?? column?.color ?? null;
}

/** Generate the complete Office-owned descendant stylesheet for all live table cells. */
export function renderOfficeTableColorStylesheet(
  tables: readonly OfficeTableColorStylesheetTable[],
): string {
  const declarations: string[] = [];
  for (const table of tables) {
    for (const cell of table.cells) {
      const color = rulesToCellColor(table.rules, cell.rowIndex, cell.columnIndex);
      if (!color) continue;
      declarations.push(
        `[data-rv-tid="${table.tableId}"] > tbody > tr:nth-child(${cell.physicalRowIndex + 1}) > :nth-child(${cell.physicalColumnIndex + 1}) { background-color: ${color} !important; }`,
      );
    }
  }
  return declarations.join('\n');
}
