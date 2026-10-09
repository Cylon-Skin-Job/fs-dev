/**
 * @module officeTableHardbreak
 * @role Stable Office-only node view for Milkdown explicit and inline hardbreaks.
 */
import { hardbreakSchema } from '@milkdown/kit/preset/commonmark';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type {
  NodeView,
  NodeViewConstructor,
} from '@milkdown/kit/prose/view';
import { $view } from '@milkdown/kit/utils';

export class OfficeTableHardbreakNodeView implements NodeView {
  dom: HTMLSpanElement;
  private node: ProseNode;

  constructor(node: ProseNode) {
    this.node = node;
    this.dom = document.createElement('span');
    this.dom.dataset.type = 'hardbreak';
    this.syncBranch(node);
  }

  private syncBranch(node: ProseNode) {
    const isInline = node.attrs.isInline === true;
    this.dom.dataset.isInline = String(isInline);
    this.dom.dataset.rvHardbreak = isInline ? 'inline' : 'explicit';
    if (isInline) {
      if (this.dom.childNodes.length !== 1
        || this.dom.firstChild?.nodeType !== Node.TEXT_NODE
        || this.dom.textContent !== ' ') {
        this.dom.replaceChildren(document.createTextNode(' '));
      }
      return;
    }
    if (this.dom.childNodes.length !== 1 || this.dom.firstElementChild?.tagName !== 'BR') {
      this.dom.replaceChildren(document.createElement('br'));
    }
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.syncBranch(node);
    return true;
  }

  destroy() {
    this.dom.remove();
  }
}

export const createOfficeTableHardbreakNodeView: NodeViewConstructor = (node) => (
  new OfficeTableHardbreakNodeView(node)
);

export const officeTableHardbreakNodeView = $view(
  hardbreakSchema.node,
  (): NodeViewConstructor => createOfficeTableHardbreakNodeView,
);
