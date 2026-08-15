/**
 * @module officeTableBreakCodec
 * @role Preserve exact semantic HTML breaks inside GFM table cells.
 */
import {
  remarkPluginsCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/kit/core';
import type { Ctx } from '@milkdown/kit/ctx';
import { paragraphSchema } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type { SerializerState } from '@milkdown/kit/transformer';
import {
  defaultHandlers,
  type Handle as MdastMarkdownHandler,
} from 'mdast-util-to-markdown';

type MdastNode = {
  type: string;
  value?: string;
  children?: MdastNode[];
};

const TABLE_CELL_BREAK_SPELLINGS = new Set(['<br>', '<br/>', '<br />', '<br >']);

export function transformOfficeTableCellBreaks(tree: MdastNode): void {
  const visit = (node: MdastNode, insideTableCell: boolean) => {
    const inCell = insideTableCell || node.type === 'tableCell';
    if (!Array.isArray(node.children)) return;
    node.children = node.children.map((child) => {
      if (
        inCell
        && child.type === 'html'
        && typeof child.value === 'string'
        && TABLE_CELL_BREAK_SPELLINGS.has(child.value)
      ) {
        const { value: _value, children: _children, ...rest } = child;
        void _value;
        void _children;
        return { ...rest, type: 'break' };
      }
      visit(child, inCell);
      return child;
    });
  };
  visit(tree, false);
}

const officeTableCellBreakRemark = () => (tree: MdastNode) => {
  transformOfficeTableCellBreaks(tree);
};

export const serializeOfficeTableCellBreak: MdastMarkdownHandler = (
  node,
  parent,
  state,
  info,
) => (
  state.stack.includes('tableCell')
    ? '<br>'
    : defaultHandlers.break(node, parent, state, info)
);

export function escapeOfficeTableCellBreakText(value: string): string {
  return value.replace(/(?<!\\)<br(?:>|\/>| \/>| >)/g, '\\$&');
}

export function configureOfficeTableBreakCodec(ctx: Ctx): void {
  ctx.update(remarkPluginsCtx, (plugins) => [
    { plugin: officeTableCellBreakRemark, options: {} },
    ...plugins,
  ]);
  ctx.update(remarkStringifyOptionsCtx, (options) => {
    const previousText = options.handlers?.text ?? defaultHandlers.text;
    const serializeTableCellText: MdastMarkdownHandler = (node, parent, state, info) => {
      const serialized = previousText(node, parent, state, info);
      return state.stack.includes('tableCell')
        ? escapeOfficeTableCellBreakText(serialized)
        : serialized;
    };
    return {
      ...options,
      handlers: {
        ...options.handlers,
        break: serializeOfficeTableCellBreak,
        text: serializeTableCellText,
      },
    };
  });
}

export function isTerminalExplicitTableCellBreak(
  state: SerializerState,
  node: ProseNode,
): boolean {
  return state.top()?.type === 'tableCell'
    && node.lastChild?.type.name === 'hardbreak'
    && node.lastChild.attrs.isInline !== true;
}

export const officeTableParagraphSchema = paragraphSchema.extendSchema((previous) => (
  (ctx) => {
    const schema = previous(ctx);
    const previousRunner = schema.toMarkdown.runner;
    return {
      ...schema,
      toMarkdown: {
        ...schema.toMarkdown,
        runner: (state, node) => {
          if (state.top()?.type === 'tableCell' && node.content.size === 0) {
            state.openNode('paragraph');
            state.closeNode();
            return;
          }
          if (!isTerminalExplicitTableCellBreak(state, node)) {
            previousRunner(state, node);
            return;
          }
          state.openNode('paragraph');
          state.next(node.content);
          state.closeNode();
        },
      },
    };
  }
));
