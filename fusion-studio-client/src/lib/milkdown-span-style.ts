/**
 * @module milkdown-span-style
 * @role Custom Milkdown mark for inline font-size spans + document transformers
 *
 * Design:
 * - Editor renders spanStyle marks as <span style="..."> DOM
 * - Markdown stores them as raw HTML <span style="...">...</span>
 * - On load: html nodes in the ProseMirror doc are folded into spanStyle marks
 * - On save: spanStyle marks are expanded back to html nodes for the serializer
 */

import { $mark, $prose } from '@milkdown/kit/utils';
import type { Node as ProseNode, Schema, MarkType } from '@milkdown/prose/model';
import { Fragment } from '@milkdown/prose/model';
import type { Command, EditorState } from '@milkdown/prose/state';
import { Plugin, PluginKey } from '@milkdown/prose/state';

// ─── Mark Definition ─────────────────────────────────────────────────────────

export const spanStyleMark = $mark('spanStyle', () => ({
  attrs: {
    style: { default: '' },
  },
  parseDOM: [
    {
      tag: 'span[style]',
      getAttrs: (dom) => {
        const el = dom as HTMLElement;
        return { style: el.getAttribute('style') || '' };
      },
    },
  ],
  toDOM: (mark) => ['span', { style: mark.attrs.style }, 0],
  parseMarkdown: {
    match: () => false,
    runner: () => {},
  },
  toMarkdown: {
    match: () => false,
    runner: () => {},
  },
}));

// ─── HTML Parsing Helpers ────────────────────────────────────────────────────

function parseSpanOpen(value: string): string | null {
  const m = value.match(/^<span\s+style="([^"]*)"\s*>$/i);
  return m ? m[1] : null;
}

function isSpanClose(value: string): boolean {
  return /^<\/span\s*>$/i.test(value.trim());
}

// ─── Load Transform: html spans → spanStyle marks ────────────────────────────

function transformFragmentToMarks(fragment: Fragment, schema: Schema): Fragment {
  const children: ProseNode[] = [];
  let i = 0;

  while (i < fragment.childCount) {
    const child = fragment.child(i);

    // Look for opening <span style="...">
    if (child.type.name === 'html') {
      const style = parseSpanOpen(child.attrs.value);
      if (style) {
        let j = i + 1;
        let depth = 1;
        const collected: ProseNode[] = [];

        while (j < fragment.childCount && depth > 0) {
          const next = fragment.child(j);
          if (next.type.name === 'html') {
            if (parseSpanOpen(next.attrs.value)) depth++;
            else if (isSpanClose(next.attrs.value)) depth--;
          }
          if (depth > 0) collected.push(next);
          j++;
        }

        if (depth === 0) {
          const mark = schema.marks['spanStyle']?.create({ style });
          if (mark) {
            children.push(...applyMarkToNodes(collected, mark, schema));
            i = j;
            continue;
          }
        }
      }
    }

    if (child.childCount > 0) {
      children.push(child.copy(transformFragmentToMarks(child.content, schema)));
    } else {
      children.push(child);
    }
    i++;
  }

  return Fragment.from(children);
}

function applyMarkToNodes(nodes: ProseNode[], mark: any, schema: Schema): ProseNode[] {
  return nodes.map((node) => {
    if (node.isText) {
      return schema.text(node.text!, [...node.marks, mark]);
    }
    if (node.childCount > 0) {
      return node.copy(applyMarkToFragment(node.content, mark, schema));
    }
    return node;
  });
}

function applyMarkToFragment(fragment: Fragment, mark: any, schema: Schema): Fragment {
  const nodes: ProseNode[] = [];
  for (let i = 0; i < fragment.childCount; i++) {
    const child = fragment.child(i);
    if (child.isText) {
      nodes.push(schema.text(child.text!, [...child.marks, mark]));
    } else if (child.childCount > 0) {
      nodes.push(child.copy(applyMarkToFragment(child.content, mark, schema)));
    } else {
      nodes.push(child);
    }
  }
  return Fragment.from(nodes);
}

export function convertHtmlSpansToMarks(doc: ProseNode): ProseNode {
  return doc.copy(transformFragmentToMarks(doc.content, doc.type.schema));
}

// ─── Save Transform: spanStyle marks → html spans ────────────────────────────

function transformFragmentToHtml(fragment: Fragment, markType: MarkType, schema: Schema): { fragment: Fragment; hadMark: boolean } {
  const nodes: ProseNode[] = [];
  let hadMark = false;

  for (let i = 0; i < fragment.childCount; i++) {
    const child = fragment.child(i);

    if (child.isText) {
      // ProseMirror splits text nodes at mark boundaries, so each text node
      // either has the mark or doesn't.
      const mark = child.marks.find((m) => m.type === markType);
      if (mark) {
        hadMark = true;
        const htmlOpen = schema.nodes['html']?.create({ value: `<span style="${mark.attrs.style}">` });
        const htmlClose = schema.nodes['html']?.create({ value: '</span>' });
        const cleanText = schema.text(child.text!, child.marks.filter((m) => m.type !== markType));
        if (htmlOpen) nodes.push(htmlOpen);
        nodes.push(cleanText);
        if (htmlClose) nodes.push(htmlClose);
      } else {
        nodes.push(child);
      }
    } else if (child.childCount > 0) {
      const { fragment: childFrag, hadMark: childHadMark } = transformFragmentToHtml(child.content, markType, schema);
      if (childHadMark) {
        hadMark = true;
        nodes.push(child.copy(childFrag));
      } else {
        nodes.push(child);
      }
    } else {
      nodes.push(child);
    }
  }

  return { fragment: Fragment.from(nodes), hadMark };
}

export function convertMarksToHtmlSpans(doc: ProseNode): ProseNode {
  const markType = doc.type.schema.marks['spanStyle'];
  if (!markType) return doc;
  const { fragment } = transformFragmentToHtml(doc.content, markType, doc.type.schema);
  return doc.copy(fragment);
}

// ─── Toolbar Command: apply / adjust spanStyle on selection ──────────────────

const STEP = 0.1;
const MIN_EM = 0.5;
const MAX_EM = 3.0;

function parseFontSizeEm(style: string): number {
  const m = style.match(/font-size:\s*([0-9.]+)em/i);
  return m ? parseFloat(m[1]) : 1.0;
}

function buildFontSizeStyle(em: number): string {
  return `font-size:${em.toFixed(1)}em`;
}

export function createAdjustSpanStyleCommand(delta: number): Command {
  return (state, dispatch) => {
    const { selection, schema } = state;
    const markType = schema.marks['spanStyle'];
    if (!markType) return false;

    const { from, to, empty } = selection;
    if (empty) return false;

    const existing = state.doc.resolve(from).marks();
    const currentMark = existing.find((m) => m.type === markType);

    let newEm: number;
    if (currentMark) {
      newEm = Math.max(MIN_EM, Math.min(MAX_EM, parseFontSizeEm(currentMark.attrs.style) + delta));
    } else {
      newEm = delta > 0 ? 1.0 + STEP : 1.0 - STEP;
      newEm = Math.max(MIN_EM, Math.min(MAX_EM, newEm));
    }

    const newStyle = buildFontSizeStyle(newEm);
    const newMark = markType.create({ style: newStyle });

    if (dispatch) {
      const tr = state.tr;
      tr.removeMark(from, to, markType);
      tr.addMark(from, to, newMark);
      dispatch(tr.scrollIntoView());
    }
    return true;
  };
}

function getSelectionEm(state: EditorState): string {
  const markType = state.schema.marks['spanStyle'];
  if (!markType) return '1.0';
  const { from, empty } = state.selection;
  if (empty) return '1.0';
  const marks = state.doc.resolve(from).marks();
  const mark = marks.find((m) => m.type === markType);
  if (!mark) return '1.0';
  const m = (mark.attrs.style as string).match(/font-size:\s*([0-9.]+)em/i);
  return m ? m[1] : '1.0';
}

const emLabelPluginKey = new PluginKey('spanStyleEmLabel');

export const emLabelPlugin = $prose(() => {
  return new Plugin({
    key: emLabelPluginKey,
    view() {
      return {
        update: (view) => {
          const toolbar = document.querySelector('.milkdown-toolbar') as HTMLElement | null;
          if (!toolbar) return;

          const decBtn = toolbar.querySelector('[data-span-style="dec"]')?.closest('button') as HTMLButtonElement | null;
          const incBtn = toolbar.querySelector('[data-span-style="inc"]')?.closest('button') as HTMLButtonElement | null;
          if (!decBtn || !incBtn) return;

          let label = toolbar.querySelector('.rv-spanstyle-em-label') as HTMLSpanElement | null;
          if (!label) {
            label = document.createElement('span');
            label.className = 'rv-spanstyle-em-label';
            label.style.cssText = 'display:flex;align-self:center;align-items:baseline;gap:2px;height:32px;margin:6px;padding:0 4px;pointer-events:none;user-select:none;min-width:32px;';

            const num = document.createElement('span');
            num.className = 'rv-spanstyle-em-number';
            num.style.cssText = 'font-size:16px;font-weight:700;color:var(--accent-dim,#888);line-height:1;';
            label.appendChild(num);

            const unit = document.createElement('span');
            unit.className = 'rv-spanstyle-em-unit';
            unit.style.cssText = 'font-size:11px;font-weight:600;color:var(--accent-dim,#888);line-height:1;';
            unit.textContent = ' em';
            label.appendChild(unit);

            incBtn.parentNode!.insertBefore(label, incBtn);
          }

          const em = getSelectionEm(view.state);
          const numSpan = label.querySelector('.rv-spanstyle-em-number') as HTMLSpanElement;
          if (numSpan) numSpan.textContent = em;
        },
      };
    },
  });
});
