import {
  DOCUMENT_TABLE_BORDER_WIDTHS,
  type DocumentTableAlignment,
  type DocumentTableBorderWidth,
  type DocumentTableOverflow,
} from '../../lib/front-matter';
import type {
  MenuDescriptor,
  MenuExternalChildContext,
  MenuOutcome,
} from '../menu';
import {
  getOfficeTableActionDisabledReason,
  getOfficeTableMutationForAction,
  isOfficeTableMutationForbiddenForVerifiedTitle,
  type OfficeTableAction,
  type OfficeTableContext,
} from './officeTableMenuModel';

const OFFICE_TABLE_OVERFLOW_CHOICES: ReadonlyArray<{
  label: string;
  value: DocumentTableOverflow;
}> = [
  { label: 'Overflow', value: 'overflow' },
  { label: 'Truncate', value: 'truncate' },
  { label: 'New line', value: 'newline' },
];

const OFFICE_TABLE_ALIGNMENT_CHOICES: ReadonlyArray<{
  label: string;
  icon: string;
  value: DocumentTableAlignment;
}> = [
  { label: 'Align table left', icon: 'align_horizontal_left', value: 'left' },
  { label: 'Align table center', icon: 'align_horizontal_center', value: 'center' },
  { label: 'Align table right', icon: 'align_horizontal_right', value: 'right' },
];

export interface OfficeTableColorMenuItem {
  id: string;
  label: string;
  icon?: string;
  secondaryText?: string;
  ariaLabel?: string;
  onOpen: (external: MenuExternalChildContext) => void;
}

interface OfficeTableMenuDescriptorActions {
  runTitle: (action: 'add' | 'delete') => MenuOutcome;
  setBorderWidth: (width: DocumentTableBorderWidth) => MenuOutcome;
  setAlignment: (alignment: DocumentTableAlignment) => MenuOutcome;
  setOverflow: (overflow: DocumentTableOverflow) => MenuOutcome;
  runStructure: (action: OfficeTableAction) => MenuOutcome;
  removeTable: () => MenuOutcome;
}

export interface OfficeTableMenuDescriptorOptions {
  context: OfficeTableContext;
  borderWidth: DocumentTableBorderWidth;
  borderColor: OfficeTableColorMenuItem;
  alignment: DocumentTableAlignment;
  overflowMode: DocumentTableOverflow;
  colors?: readonly [
    OfficeTableColorMenuItem,
    OfficeTableColorMenuItem,
    OfficeTableColorMenuItem,
  ];
  actions: OfficeTableMenuDescriptorActions;
}

function colorDescriptor(item: OfficeTableColorMenuItem): MenuDescriptor {
  return {
    kind: 'external-child',
    id: item.id,
    label: item.label,
    icon: item.icon ?? 'colors',
    secondaryText: item.secondaryText,
    ariaLabel: item.ariaLabel,
    openOn: 'activate',
    onOpen: item.onOpen,
  };
}

export function buildOfficeTableMenuDescriptors(
  options: OfficeTableMenuDescriptorOptions,
): readonly MenuDescriptor[] {
  const {
    context,
    borderWidth,
    alignment,
    overflowMode,
    actions,
  } = options;
  const currentModeLabel = OFFICE_TABLE_OVERFLOW_CHOICES.find(
    ({ value }) => value === overflowMode,
  )?.label ?? 'Overflow';
  const borderWidthItems: readonly MenuDescriptor[] = DOCUMENT_TABLE_BORDER_WIDTHS.map((width) => ({
    kind: 'radio' as const,
    id: `table-border-width-${width}`,
    label: `${width}px`,
    checked: borderWidth === width,
    onSelect: () => actions.setBorderWidth(width),
  }));
  const overflowItems: readonly MenuDescriptor[] = OFFICE_TABLE_OVERFLOW_CHOICES.map(({ label, value }) => ({
    kind: 'radio' as const,
    id: `table-overflow-${value}`,
    label,
    checked: overflowMode === value,
    onSelect: () => actions.setOverflow(value),
  }));
  const tableItems: readonly MenuDescriptor[] = [
    {
      kind: 'action', id: 'table-add-title-row', label: 'Add title row', icon: 'variable_add',
      disabled: context.topRowCellCount === 1,
      onSelect: () => actions.runTitle('add'),
    },
    { kind: 'separator', id: 'table-separator-title' },
    {
      kind: 'submenu', id: 'table-border-size', label: 'Border size', icon: 'border_all',
      secondaryText: `${borderWidth}px`,
      ariaLabel: options.borderColor.secondaryText === 'None'
        ? `Border size: current width ${borderWidth}px. The editor guide uses ${borderWidth}px and output has no border.`
        : `Border size: current width ${borderWidth}px`,
      items: borderWidthItems,
    },
    colorDescriptor(options.borderColor),
    { kind: 'separator', id: 'table-separator-border' },
    ...OFFICE_TABLE_ALIGNMENT_CHOICES.map(({ label, icon, value }): MenuDescriptor => ({
      kind: 'radio', id: `table-alignment-${value}`, label, icon, checked: alignment === value,
      onSelect: () => actions.setAlignment(value),
    })),
    { kind: 'separator', id: 'table-separator-alignment' },
    {
      kind: 'submenu', id: 'table-overflow', label: 'Overflow', icon: 'format_text_overflow',
      secondaryText: currentModeLabel,
      ariaLabel: `Overflow: current mode ${currentModeLabel}`,
      items: overflowItems,
    },
    { kind: 'separator', id: 'table-separator-remove' },
    {
      kind: 'action', id: 'table-remove', label: 'Remove table', icon: 'delete', tone: 'destructive',
      onSelect: actions.removeTable,
    },
  ];

  const items: MenuDescriptor[] = [
    { kind: 'submenu', id: 'table-settings', label: 'Table', icon: 'table_edit', items: tableItems },
    { kind: 'separator', id: 'table-root-separator-settings' },
  ];
  if (options.colors) {
    items.push(
      ...options.colors.map(colorDescriptor),
      { kind: 'separator', id: 'table-root-separator-colors' },
    );
  }

  const titleContext = context.verifiedTitleContext === true;
  const structureAction = (
    id: string,
    label: string,
    icon: string,
    action: OfficeTableAction,
    disabled = false,
    disabledReason?: string,
  ): MenuDescriptor => ({
    kind: 'action', id, label, icon, disabled, disabledReason,
    onSelect: () => actions.runStructure(action),
  });
  items.push(
    structureAction('table-insert-row-above', 'Insert Row Above', 'add', 'insert-row-above', titleContext),
    structureAction('table-insert-row-below', 'Insert Row Below', 'add', 'insert-row-below'),
    structureAction('table-insert-column-left', 'Insert Column Left', 'add', 'insert-col-left', titleContext),
    structureAction('table-insert-column-right', 'Insert Column Right', 'add', 'insert-col-right', titleContext),
    { kind: 'separator', id: 'table-root-separator-delete' },
  );
  if (titleContext) {
    items.push({
      kind: 'action', id: 'table-delete-title-row', label: 'Delete Row', icon: 'delete',
      disabled: context.rowCount < 3,
      onSelect: () => actions.runTitle('delete'),
    });
  }
  const deletes: Array<[string, string, OfficeTableAction]> = [
    ['table-delete-row-above', 'Delete Row Above', 'delete-row-above'],
    ['table-delete-row-below', 'Delete Row Below', 'delete-row-below'],
    ['table-delete-column-left', 'Delete Column Left', 'delete-col-left'],
    ['table-delete-column-right', 'Delete Column Right', 'delete-col-right'],
  ];
  deletes.forEach(([id, label, action]) => {
    const mutation = getOfficeTableMutationForAction(context, action);
    const disabledForTitle = (titleContext && [
      'delete-row-above', 'delete-col-left', 'delete-col-right',
    ].includes(action)) || Boolean(
      mutation && isOfficeTableMutationForbiddenForVerifiedTitle(context, mutation),
    );
    const disabledReason = disabledForTitle ? undefined : getOfficeTableActionDisabledReason(context, action);
    items.push(structureAction(
      id, label, 'delete', action, disabledForTitle || Boolean(disabledReason), disabledReason,
    ));
  });
  return items;
}
