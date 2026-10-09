/**
 * @module officeTableNodeView
 * @role Office-owned Milkdown table node view. It keeps Milkdown's table
 *       schema/commands but removes Crepe's row/column hover controls.
 *
 *       The <colgroup> used for column widths is baked into the node view's
 *       own DOM from creation, so ProseMirror treats it as part of the table
 *       rather than a foreign element bolted on later (which used to provoke a
 *       constant rebuild). Column widths are set as inline styles on its <col>
 *       elements by officeTableGeometry.
 */
import { tableSchema } from '@milkdown/kit/preset/gfm';
import { TableMap } from '@milkdown/kit/prose/tables';
import { $view } from '@milkdown/kit/utils';
import type { Node as ProseNode } from '@milkdown/kit/prose/model';
import type {
  EditorView,
  NodeView,
  NodeViewConstructor,
  ViewMutationRecord,
} from '@milkdown/kit/prose/view';

export type OfficeTableLogicalColumnDefinition = {
  index: number;
};

export type OfficeTableLogicalBoundaryPlan =
  | { kind: 'left-outer'; index: 0 }
  | { kind: 'internal'; index: number }
  | { kind: 'right-outer'; index: number };

export type OfficeTableNodeViewPlan = {
  logicalWidth: number;
  colDefinitions: OfficeTableLogicalColumnDefinition[];
  boundaryPlans: OfficeTableLogicalBoundaryPlan[];
};

export function planOfficeTableLogicalBoundaries(
  logicalWidth: number,
): OfficeTableLogicalBoundaryPlan[] {
  if (!Number.isSafeInteger(logicalWidth) || logicalWidth < 1) return [];
  return [
    { kind: 'left-outer', index: 0 },
    ...Array.from(
      { length: logicalWidth - 1 },
      (_, offset): OfficeTableLogicalBoundaryPlan => ({ kind: 'internal', index: offset + 1 }),
    ),
    { kind: 'right-outer', index: logicalWidth },
  ];
}

/**
 * Plans only the Office-owned table chrome. TableMap is the authority so a
 * physically single-cell header spanning N columns still produces N baked
 * <col> definitions and N+1 logical resize boundaries.
 */
export function planOfficeTableNodeView(node: ProseNode): OfficeTableNodeViewPlan {
  const logicalWidth = TableMap.get(node).width;
  const colDefinitions = Array.from(
    { length: logicalWidth },
    (_, index) => ({ index }),
  );
  const boundaryPlans = planOfficeTableLogicalBoundaries(logicalWidth);
  return { logicalWidth, colDefinitions, boundaryPlans };
}

export class OfficeTableNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private colgroup: HTMLTableColElement;
  private tableElement: HTMLTableElement;
  private node: ProseNode;

  constructor(node: ProseNode, _view: EditorView, _getPos: () => number | undefined) {
    void _view;
    void _getPos;
    this.node = node;

    const dom = document.createElement('div');
    dom.className = 'milkdown-table-block rv-office-table-block';

    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper rv-office-table-wrapper';

    const table = document.createElement('table');
    table.className = 'children rv-office-table';

    const colgroup = document.createElement('colgroup') as unknown as HTMLTableColElement;

    const contentDOM = document.createElement('tbody');
    contentDOM.setAttribute('data-content-dom', 'true');
    contentDOM.className = 'content-dom';

    table.appendChild(colgroup);
    table.appendChild(contentDOM);
    wrapper.appendChild(table);
    dom.appendChild(wrapper);

    this.dom = dom;
    this.contentDOM = contentDOM;
    this.colgroup = colgroup;
    this.tableElement = table;
    this.syncColgroup(node);
    this.syncTitleState(node);
  }

  private syncColgroup(node: ProseNode) {
    const count = planOfficeTableNodeView(node).colDefinitions.length;
    while (this.colgroup.children.length < count) {
      this.colgroup.appendChild(document.createElement('col'));
    }
    while (this.colgroup.children.length > count) {
      this.colgroup.lastElementChild?.remove();
    }
  }

  private syncTitleState(node: ProseNode) {
    const state = node.attrs.officeTitleRowState;
    const diagnostic = node.attrs.officeTitleDiagnostic;
    if (state === 'valid' || state === 'stale') {
      this.tableElement.dataset.rvTitleRowState = state;
    } else {
      delete this.tableElement.dataset.rvTitleRowState;
    }
    if (state === 'stale' && typeof diagnostic === 'string' && diagnostic) {
      this.tableElement.dataset.rvTitleRowDiagnostic = diagnostic;
    } else {
      delete this.tableElement.dataset.rvTitleRowDiagnostic;
    }
  }

  update(node: ProseNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.syncColgroup(node);
    this.syncTitleState(node);
    return true;
  }

  stopEvent(event: Event) {
    return event.type === 'drop' || event.type.startsWith('drag');
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    if ((mutation.type as unknown) === 'selection') return false;
    // Ignore attribute mutations (the inline column-width styles the Office
    // geometry layer writes onto the table / colgroup). They are presentational,
    // never document edits — reacting to them made ProseMirror rebuild the table.
    if (mutation.type === 'attributes') return true;
    // Ignore anything outside the editable body (colgroup, wrapper chrome).
    if (this.contentDOM.contains(mutation.target)) return false;
    return true;
  }

  destroy() {
    this.dom.remove();
    this.contentDOM.remove();
  }
}

export const createOfficeTableNodeView: NodeViewConstructor = (node, view, getPos) => (
  new OfficeTableNodeView(node, view, getPos)
);

export const officeTableNodeView = $view(
  tableSchema.node,
  (): NodeViewConstructor => {
    return createOfficeTableNodeView;
  },
);
