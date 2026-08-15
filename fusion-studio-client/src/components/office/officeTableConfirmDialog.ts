/**
 * @module officeTableConfirmDialog
 * @role Office-owned modal confirmation for whole-table removal requests.
 */
import {
  OFFICE_TABLE_REMOVE_REQUEST_EVENT,
  type OfficeTableRemoveRequest,
} from './officeTableContextMenu';

const WARNING_TEXT = 'All data inside the table will be lost.';
let dialogGeneration = 0;

export type OfficeTableConfirmDialogController = {
  cleanup: () => void;
};

export function installOfficeTableConfirmDialog(
  root: HTMLElement,
  onConfirm: (request: OfficeTableRemoveRequest) => void,
): OfficeTableConfirmDialogController {
  let overlay: HTMLDivElement | null = null;
  let activeRequest: OfficeTableRemoveRequest | null = null;
  let cancelButton: HTMLButtonElement | null = null;
  let confirmButton: HTMLButtonElement | null = null;

  const removeDialog = () => {
    window.removeEventListener('keydown', onWindowKeyDown, true);
    overlay?.remove();
    overlay = null;
    cancelButton = null;
    confirmButton = null;
  };

  const dismiss = () => {
    const request = activeRequest;
    activeRequest = null;
    removeDialog();
    request?.restoreEditorFocus();
  };

  const confirm = () => {
    const request = activeRequest;
    activeRequest = null;
    removeDialog();
    if (request) onConfirm(request);
  };

  function onWindowKeyDown(event: KeyboardEvent) {
    if (!overlay) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss();
      return;
    }
    if (event.key !== 'Tab' || !cancelButton || !confirmButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const focusConfirm = event.shiftKey
      ? document.activeElement === cancelButton
      : document.activeElement !== confirmButton;
    (focusConfirm ? confirmButton : cancelButton).focus({ preventScroll: true });
  }

  const open = (request: OfficeTableRemoveRequest) => {
    if (overlay) return;
    dialogGeneration += 1;
    const titleId = `rv-office-table-confirm-title-${dialogGeneration}`;
    const descriptionId = `rv-office-table-confirm-description-${dialogGeneration}`;

    overlay = document.createElement('div');
    overlay.className = 'rv-office-table-confirm-overlay';
    overlay.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    overlay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    overlay.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    const dialog = document.createElement('div');
    dialog.className = 'rv-office-table-confirm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-describedby', descriptionId);

    const title = document.createElement('h2');
    title.id = titleId;
    title.textContent = 'Remove table';

    const warning = document.createElement('p');
    warning.id = descriptionId;
    warning.textContent = WARNING_TEXT;

    const actions = document.createElement('div');
    actions.className = 'rv-office-table-confirm-actions';

    cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'rv-office-table-confirm-button rv-office-table-confirm-cancel';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', dismiss);

    confirmButton = document.createElement('button');
    confirmButton.type = 'button';
    confirmButton.className = 'rv-office-table-confirm-button rv-office-table-confirm-remove';
    confirmButton.textContent = 'Remove table';
    confirmButton.addEventListener('click', confirm);

    actions.append(cancelButton, confirmButton);
    dialog.append(title, warning, actions);
    overlay.appendChild(dialog);
    activeRequest = request;
    document.body.appendChild(overlay);
    window.addEventListener('keydown', onWindowKeyDown, true);
    cancelButton.focus({ preventScroll: true });
  };

  const onRemoveRequest = (event: Event) => {
    if (!(event instanceof CustomEvent)) return;
    const request = event.detail as Partial<OfficeTableRemoveRequest> | undefined;
    if (!request?.context || !request.capture || typeof request.restoreEditorFocus !== 'function') return;
    event.preventDefault();
    open(request as OfficeTableRemoveRequest);
  };

  root.addEventListener(OFFICE_TABLE_REMOVE_REQUEST_EVENT, onRemoveRequest);

  return {
    cleanup: () => {
      root.removeEventListener(OFFICE_TABLE_REMOVE_REQUEST_EVENT, onRemoveRequest);
      activeRequest = null;
      removeDialog();
    },
  };
}
