import { useCallback, useEffect, useRef, useState } from 'react';
import { openMenuTree } from '../menu';
import type { MenuDescriptor, MenuHandle, MenuOutcome } from '../menu';

type ExportingFormat = 'docx' | 'pdf' | 'markdown' | null;

interface OfficeDocumentExportMenuButtonProps {
  exportingFormat: ExportingFormat;
  onExport: (format: 'docx' | 'pdf') => void | Promise<void>;
  onPrint: () => void | Promise<void>;
  onSendEmail: (format: 'docx' | 'pdf' | 'markdown') => void | Promise<void>;
}

const CLOSE_ALL: MenuOutcome = { kind: 'close-all' };

export function OfficeDocumentExportMenuButton({
  exportingFormat,
  onExport,
  onPrint,
  onSendEmail,
}: OfficeDocumentExportMenuButtonProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<MenuHandle | null>(null);
  const [expanded, setExpanded] = useState(false);
  const disabled = exportingFormat !== null;

  useEffect(() => () => {
    menuRef.current?.close('programmatic');
    menuRef.current = null;
  }, []);

  useEffect(() => {
    if (!disabled) return;
    menuRef.current?.close('programmatic');
  }, [disabled]);

  const openMenu = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || trigger.disabled) return;

    const items: MenuDescriptor[] = [
      {
        kind: 'submenu',
        id: 'office-export-docx',
        label: 'Export DOCX',
        icon: 'description',
        items: [
          {
            kind: 'action',
            id: 'office-export-docx-email',
            label: 'Email',
            icon: 'attach_email',
            onSelect: async () => {
              await onSendEmail('docx');
              return CLOSE_ALL;
            },
          },
          {
            kind: 'action',
            id: 'office-export-docx-folder',
            label: 'Folder',
            icon: 'drive_file_move',
            onSelect: async () => {
              await onExport('docx');
              return CLOSE_ALL;
            },
          },
        ],
      },
      {
        kind: 'submenu',
        id: 'office-export-pdf',
        label: 'Export PDF',
        icon: 'picture_as_pdf',
        items: [
          {
            kind: 'action',
            id: 'office-export-pdf-email',
            label: 'Email',
            icon: 'attach_email',
            onSelect: async () => {
              await onSendEmail('pdf');
              return CLOSE_ALL;
            },
          },
          {
            kind: 'action',
            id: 'office-export-pdf-folder',
            label: 'Folder',
            icon: 'drive_file_move',
            onSelect: async () => {
              await onExport('pdf');
              return CLOSE_ALL;
            },
          },
        ],
      },
      {
        kind: 'action',
        id: 'office-export-markdown-email',
        label: 'Email Markdown',
        icon: 'markdown',
        onSelect: async () => {
          await onSendEmail('markdown');
          return CLOSE_ALL;
        },
      },
      { kind: 'separator', id: 'office-export-separator-output' },
      {
        kind: 'action',
        id: 'office-export-preview-pdf',
        label: 'Preview PDF',
        icon: 'print',
        onSelect: async () => {
          await onPrint();
          return CLOSE_ALL;
        },
      },
    ];

    menuRef.current?.close('replaced');
    let handle: MenuHandle;
    handle = openMenuTree({
      anchor: { kind: 'element', element: trigger, placement: 'below-start' },
      items,
      ariaLabel: 'Export document',
      minWidth: 180,
      restoreInvocationFocus: () => triggerRef.current?.focus({ preventScroll: true }),
      focusAfterAction: () => triggerRef.current?.focus({ preventScroll: true }),
      onClose: () => {
        if (menuRef.current === handle) menuRef.current = null;
        setExpanded(false);
      },
    });
    menuRef.current = handle;
    setExpanded(true);
  }, [onExport, onPrint, onSendEmail]);

  return (
    <button
      ref={triggerRef}
      type="button"
      className="rv-office-document-action"
      aria-haspopup="menu"
      aria-expanded={expanded}
      onClick={openMenu}
      disabled={disabled}
      title="Export"
    >
      <span className={`material-symbols-outlined${disabled ? ' rv-office-spin' : ''}`}>
        {disabled ? 'progress_activity' : 'bubble'}
      </span>
    </button>
  );
}
