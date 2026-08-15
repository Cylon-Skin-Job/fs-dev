/**
 * @module officeTableTitleCodec
 * @role Rehydrate literal marked GFM title surrogates before editor creation
 *       and serialize live spanning titles back to stable GFM.
 */
import { remarkPluginsCtx } from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { tableHeaderSchema, tableSchema } from '@milkdown/kit/preset/gfm';
import type { Node as ProseNode, NodeType } from '@milkdown/kit/prose/model';
import { TableMap } from '@milkdown/kit/prose/tables';
import type { MarkdownNode } from '@milkdown/kit/transformer';
import {
  hasDocumentTableTitleRow,
  type DocumentTableStyle,
} from '../../lib/front-matter';
import {
  findTableIdentityEntry,
  fingerprintOfficeTableHeader,
} from './officeTableIdentity';

export const OFFICE_TABLE_TITLE_VALID = 'valid';
export const OFFICE_TABLE_TITLE_STALE = 'stale';

export type OfficeTableTitleState =
  | typeof OFFICE_TABLE_TITLE_VALID
  | typeof OFFICE_TABLE_TITLE_STALE;

export type OfficeTableTitleDiagnostic =
  | 'continuation-content'
  | 'invalid-logical-width'
  | 'too-few-physical-rows'
  | 'unsafe-table-shape';

type OfficeTitleMdastNode = MarkdownNode & {
  align?: Array<string | null>;
  children?: OfficeTitleMdastNode[];
  value?: string;
  officeTitleRowState?: OfficeTableTitleState;
  officeTitleDiagnostic?: OfficeTableTitleDiagnostic;
  officeTitleColspan?: number;
};

export type OfficeTableTitleCodecOutcome = {
  tableIndex: number;
  state: OfficeTableTitleState;
  diagnostic: OfficeTableTitleDiagnostic | null;
  logicalWidth: number | null;
};

function mdastText(node: OfficeTitleMdastNode): string {
  if (typeof node.value === 'string') {
    if (node.type === 'html' && /^<br\s*\/?\s*>$/i.test(node.value)) return '';
    return node.value;
  }
  return Array.isArray(node.children) ? node.children.map(mdastText).join('') : '';
}

function tableRows(table: OfficeTitleMdastNode): OfficeTitleMdastNode[] | null {
  if (!Array.isArray(table.children)) return null;
  if (!table.children.every((row) => row.type === 'tableRow' && Array.isArray(row.children))) {
    return null;
  }
  return table.children;
}

function classifyMarkedTable(table: OfficeTitleMdastNode): {
  diagnostic: OfficeTableTitleDiagnostic | null;
  logicalWidth: number | null;
} {
  const rows = tableRows(table);
  if (!rows || rows.length === 0) {
    return { diagnostic: 'unsafe-table-shape', logicalWidth: null };
  }
  const align = Array.isArray(table.align) ? table.align : [];
  const logicalWidth = align.length;
  if (!Number.isSafeInteger(logicalWidth) || logicalWidth < 1) {
    return { diagnostic: 'invalid-logical-width', logicalWidth: null };
  }
  if (rows.some((row) => row.children?.length !== logicalWidth)) {
    return { diagnostic: 'unsafe-table-shape', logicalWidth };
  }
  const header = rows[0];
  const continuation = header.children?.slice(1) ?? [];
  if (continuation.some((cell) => (cell.children?.length ?? 0) > 0)) {
    return { diagnostic: 'continuation-content', logicalWidth };
  }
  if (rows.length < 3) {
    return { diagnostic: 'too-few-physical-rows', logicalWidth };
  }
  return { diagnostic: null, logicalWidth };
}

function markerForTable(
  styles: unknown,
  table: OfficeTitleMdastNode,
  tableIndex: number,
): DocumentTableStyle | undefined {
  const rows = tableRows(table);
  const headerCells = rows?.[0]?.children?.map(mdastText) ?? [];
  const logicalWidth = Array.isArray(table.align) ? table.align.length : headerCells.length;
  return findTableIdentityEntry<DocumentTableStyle>(styles, {
    tableIndex,
    fingerprint: fingerprintOfficeTableHeader(logicalWidth, headerCells),
  });
}

/**
 * Mutates only marked MDAST tables. Stale tables receive durable parse-state
 * annotations but retain their complete row/cell tree byte-for-node.
 */
export function transformOfficeTableTitles(
  tree: OfficeTitleMdastNode,
  styles: unknown,
): OfficeTableTitleCodecOutcome[] {
  const outcomes: OfficeTableTitleCodecOutcome[] = [];
  let tableIndex = 0;
  const visit = (node: OfficeTitleMdastNode) => {
    if (node.type === 'table') {
      const currentIndex = tableIndex;
      tableIndex += 1;
      const marker = markerForTable(styles, node, currentIndex);
      if (hasDocumentTableTitleRow(marker)) {
        const classification = classifyMarkedTable(node);
        if (classification.diagnostic) {
          node.officeTitleRowState = OFFICE_TABLE_TITLE_STALE;
          node.officeTitleDiagnostic = classification.diagnostic;
          outcomes.push({
            tableIndex: currentIndex,
            state: OFFICE_TABLE_TITLE_STALE,
            diagnostic: classification.diagnostic,
            logicalWidth: classification.logicalWidth,
          });
        } else {
          const header = node.children?.[0];
          const firstCell = header?.children?.[0];
          if (!header || !firstCell || !classification.logicalWidth) {
            node.officeTitleRowState = OFFICE_TABLE_TITLE_STALE;
            node.officeTitleDiagnostic = 'unsafe-table-shape';
            outcomes.push({
              tableIndex: currentIndex,
              state: OFFICE_TABLE_TITLE_STALE,
              diagnostic: 'unsafe-table-shape',
              logicalWidth: classification.logicalWidth,
            });
          } else {
            firstCell.officeTitleColspan = classification.logicalWidth;
            header.children = [firstCell];
            node.officeTitleRowState = OFFICE_TABLE_TITLE_VALID;
            outcomes.push({
              tableIndex: currentIndex,
              state: OFFICE_TABLE_TITLE_VALID,
              diagnostic: null,
              logicalWidth: classification.logicalWidth,
            });
          }
        }
      }
    }
    node.children?.forEach(visit);
  };
  visit(tree);
  return outcomes;
}

export function configureOfficeTableTitleCodec(tableStyles: unknown) {
  const officeTableTitleRemark = () => (tree: unknown) => {
    transformOfficeTableTitles(tree as OfficeTitleMdastNode, tableStyles);
  };
  return (ctx: Ctx): void => {
    ctx.update(remarkPluginsCtx, (plugins) => [
      { plugin: officeTableTitleRemark, options: {} },
      ...plugins,
    ]);
  };
}

function parseTableState(node: OfficeTitleMdastNode) {
  const state = node.officeTitleRowState;
  return state === OFFICE_TABLE_TITLE_VALID || state === OFFICE_TABLE_TITLE_STALE
    ? state
    : null;
}

function logicalAlignmentVector(row: ProseNode, width: number): Array<string | null> | null {
  const alignments: Array<string | null> = [];
  for (let index = 0; index < row.childCount; index += 1) {
    const cell = row.child(index);
    const colspan = Number(cell.attrs.colspan ?? 1);
    if (!Number.isSafeInteger(colspan) || colspan < 1) return null;
    const alignment = typeof cell.attrs.alignment === 'string'
      ? cell.attrs.alignment
      : null;
    for (let offset = 0; offset < colspan; offset += 1) alignments.push(alignment);
  }
  return alignments.length === width ? alignments : null;
}

export function getVerifiedOfficeTableTitleWidth(node: ProseNode): number | null {
  if (node.attrs.officeTitleRowState !== OFFICE_TABLE_TITLE_VALID || node.childCount < 3) {
    return null;
  }
  const header = node.firstChild;
  if (!header || header.childCount !== 1) return null;
  const width = TableMap.get(node).width;
  return header.firstChild?.attrs.colspan === width ? width : null;
}

export const officeTableTitleSchema = tableSchema.extendSchema((previous) => (
  (ctx) => {
    const schema = previous(ctx);
    return {
      ...schema,
      attrs: {
        ...schema.attrs,
        officeTitleRowState: { default: null, validate: 'string|null' },
        officeTitleDiagnostic: { default: null, validate: 'string|null' },
      },
      parseDOM: [
        {
          tag: 'table.rv-office-table',
          getAttrs: (dom) => {
            if (!(dom instanceof HTMLElement)) return false;
            const state = dom.dataset.rvTitleRowState;
            const diagnostic = dom.dataset.rvTitleRowDiagnostic;
            if (state === OFFICE_TABLE_TITLE_VALID) {
              return { officeTitleRowState: state, officeTitleDiagnostic: null };
            }
            if (state === OFFICE_TABLE_TITLE_STALE && [
              'continuation-content',
              'invalid-logical-width',
              'too-few-physical-rows',
              'unsafe-table-shape',
            ].includes(diagnostic ?? '')) {
              return { officeTitleRowState: state, officeTitleDiagnostic: diagnostic };
            }
            return { officeTitleRowState: null, officeTitleDiagnostic: null };
          },
        },
        ...(schema.parseDOM ?? []),
      ],
      parseMarkdown: {
        match: schema.parseMarkdown.match,
        runner: (state, rawNode, type) => {
          const node = rawNode as OfficeTitleMdastNode;
          const align = Array.isArray(node.align) ? node.align : [];
          const children = (node.children ?? []).map((row, index) => ({
            ...row,
            align,
            isHeader: index === 0,
          }));
          state.openNode(type, {
            officeTitleRowState: parseTableState(node),
            officeTitleDiagnostic: node.officeTitleDiagnostic ?? null,
          });
          state.next(children);
          state.closeNode();
        },
      },
      toMarkdown: {
        match: schema.toMarkdown.match,
        runner: (state, node) => {
          const width = getVerifiedOfficeTableTitleWidth(node);
          const demotedHeader = width ? node.maybeChild(1) : null;
          const align = demotedHeader && width
            ? logicalAlignmentVector(demotedHeader, width)
            : null;
          if (!align) {
            schema.toMarkdown.runner(state, node);
            return;
          }
          state.openNode('table', undefined, { align });
          state.next(node.content);
          state.closeNode();
        },
      },
    };
  }
));

export const officeTableTitleHeaderSchema = tableHeaderSchema.extendSchema((previous) => (
  (ctx) => {
    const schema = previous(ctx);
    return {
      ...schema,
      parseMarkdown: {
        match: schema.parseMarkdown.match,
        runner: (state, rawNode, type) => {
          const node = rawNode as OfficeTitleMdastNode;
          const colspan = Number(node.officeTitleColspan);
          if (!Number.isSafeInteger(colspan) || colspan < 1) {
            schema.parseMarkdown.runner(state, node, type);
            return;
          }
          state.openNode(type as NodeType, {
            alignment: node.align,
            colspan,
          });
          state.openNode(state.schema.nodes.paragraph as NodeType);
          state.next(node.children ?? []);
          state.closeNode();
          state.closeNode();
        },
      },
    };
  }
));
