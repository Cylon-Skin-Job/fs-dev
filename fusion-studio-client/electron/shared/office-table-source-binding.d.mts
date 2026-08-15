export type Sha256Hex = (bytes: Uint8Array) => Promise<string>;

export interface BoundOfficeTableSource {
  tableIndex: number;
  sourceSha256: string;
  logicalWidth: number;
  semanticRows: string[][];
  cellChildCounts: number[][];
  startOffset: number;
  endOffset: number;
}

export function bindOfficeTableSources(
  markdown: string,
  sha256Hex: Sha256Hex,
): Promise<{
  markdownSha256: string;
  tables: BoundOfficeTableSource[];
}>;

export function getOfficeDescriptorByteLimit(
  bodyUtf8Bytes: number,
  tableCount: number,
  totalLogicalColumns: number,
): number;
