import type { ViewTabAddAction, ViewTabDescriptor } from './ViewTabStrip';
import { viewTabSingleIdentityDomId } from './viewTabDomIds';

export interface SingleTabIdentityProps {
  panelId: string;
  descriptor: ViewTabDescriptor;
  add?: ViewTabAddAction;
  onClose: (tabId: string) => void;
  onFocusAddedTab?: (tabId: string) => void;
  onRecoverCloseFocus?: (closedTabId: string, origin: HTMLElement) => void;
}

/** Presents one active tab's descriptor identity and permitted shell actions. */
export function SingleTabIdentity({
  panelId,
  descriptor,
  add,
  onClose,
  onFocusAddedTab,
  onRecoverCloseFocus,
}: SingleTabIdentityProps) {
  return (
    <header className="rv-component-tab-single-chrome">
      <div className="rv-component-tab-single-leading">
        {add ? (
          <button
            type="button"
            className="rv-component-tab-single-add"
            aria-label={add.label}
            title={add.label}
            onClick={(event) => {
              const createdId = add.onAdd();
              if (createdId) onFocusAddedTab?.(createdId);
              else event.currentTarget.focus();
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {add.icon ?? 'add'}
            </span>
          </button>
        ) : null}
      </div>
      <div className="rv-component-tab-single-identity">
        <span
          className={`material-symbols-outlined rv-component-tab-single-icon${descriptor.iconClassName ? ` ${descriptor.iconClassName}` : ''}`}
          aria-hidden="true"
        >
          {descriptor.icon}
        </span>
        <span
          id={viewTabSingleIdentityDomId(panelId, descriptor.id)}
          className="rv-component-tab-single-label"
          data-tab-id={descriptor.id}
          tabIndex={-1}
        >
          {descriptor.label}
        </span>
        {descriptor.closable ? (
          <button
            type="button"
            className="rv-component-tab-single-close"
            aria-label={descriptor.closeLabel}
            title={descriptor.closeLabel}
            disabled={descriptor.closeDisabled}
            onClick={(event) => {
              if (descriptor.closeDisabled) return;
              const origin = event.currentTarget;
              onClose(descriptor.id);
              onRecoverCloseFocus?.(descriptor.id, origin);
            }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        ) : null}
      </div>
      <div className="rv-component-tab-single-trailing" aria-hidden="true" />
    </header>
  );
}
