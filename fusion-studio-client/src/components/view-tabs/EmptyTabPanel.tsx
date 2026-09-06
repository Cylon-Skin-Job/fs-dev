import { useId } from 'react';
import type { EmptyTabReservation } from './componentTabTypes';

export interface EmptyTabLauncherItem {
  id: string;
  label: string;
  icon: string;
  description?: string;
  disabled?: boolean;
}

export interface EmptyTabPanelProps {
  tabId: string;
  items: readonly EmptyTabLauncherItem[];
  reservation: EmptyTabReservation | null;
  onSelect: (tabId: string, launcherId: string) => void;
  onRetry: (tabId: string) => void;
  onCancel: (tabId: string) => void;
}

/** Neutral launcher presentation for one explicitly supplied empty container. */
export function EmptyTabPanel({
  tabId,
  items,
  reservation,
  onSelect,
  onRetry,
  onCancel,
}: EmptyTabPanelProps) {
  const headingId = useId();
  const descriptionIdPrefix = useId();
  const pending = reservation?.status === 'pending';
  const failed = reservation?.status === 'failed';
  const selectedItem = items.find((item) => item.id === reservation?.launcherId);

  return (
    <section
      className="rv-empty-tab-panel"
      aria-labelledby={headingId}
      aria-busy={pending || undefined}
    >
      <div className="rv-empty-tab-content">
        <header className="rv-empty-tab-header">
          <h2 id={headingId} className="rv-empty-tab-heading">Add content</h2>
          <p className="rv-empty-tab-copy">Choose an available item for this tab.</p>
        </header>

        {items.length > 0 ? (
          <div className="rv-empty-tab-launchers">
            {items.map((item, index) => {
              const descriptionId = item.description
                ? `${descriptionIdPrefix}-${index}`
                : undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="rv-empty-tab-launcher"
                  disabled={Boolean(item.disabled || reservation)}
                  aria-describedby={descriptionId}
                  onClick={() => onSelect(tabId, item.id)}
                >
                  <span
                    className="material-symbols-outlined rv-empty-tab-launcher-icon"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="rv-empty-tab-launcher-text">
                    <span className="rv-empty-tab-launcher-label">{item.label}</span>
                    {item.description ? (
                      <span id={descriptionId} className="rv-empty-tab-launcher-description">
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rv-empty-tab-copy">No content is available to add.</p>
        )}

        {pending ? (
          <div className="rv-empty-tab-reservation" role="status" aria-live="polite">
            <span className="rv-empty-tab-reservation-message">
              Opening {selectedItem?.label ?? 'content'}…
            </span>
            <button
              type="button"
              className="rv-empty-tab-action"
              onClick={() => onCancel(tabId)}
            >
              Cancel
            </button>
          </div>
        ) : null}

        {failed ? (
          <div className="rv-empty-tab-reservation">
            <p className="rv-empty-tab-error" role="alert">
              {reservation.error?.message ?? 'The content could not be opened. Try again.'}
            </p>
            <div className="rv-empty-tab-actions">
              <button
                type="button"
                className="rv-empty-tab-action"
                onClick={() => onRetry(tabId)}
              >
                Retry {selectedItem?.label ?? 'content'}
              </button>
              <button
                type="button"
                className="rv-empty-tab-action"
                onClick={() => onCancel(tabId)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
