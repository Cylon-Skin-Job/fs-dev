import { type ReactNode } from 'react';
import type { EmptyTabReservation } from './componentTabTypes';
import { PresenterErrorBoundary } from './PresenterErrorBoundary';

export interface EmptyTabPanelProps {
  tabId: string;
  reservation: EmptyTabReservation | null;
  /**
   * VIEW-02 §6: the "Add content" launcher grid is retired — an Empty tab
   * presents no menu. The reservation machinery survives as the container/
   * lifecycle mechanism and bounded failure surface (pending, failed/retry/
   * cancel remain, generically).
   *
   * A view may supply a bounded Empty-body presenter (resolved by its
   * connected owner layer, analogous to first-party component
   * registrations). Absent (or failed) presenters fall back to a minimal
   * neutral surface with no menu and no launch actions.
   */
  renderEmptyBody?: (tabId: string) => ReactNode;
  /** Bounded display label of the reserved launcher, from the connected layer. */
  reservationLabel?: string;
  onRetry: (tabId: string) => void;
  onCancel: (tabId: string) => void;
}

function NeutralEmptySurface() {
  return (
    <p className="rv-empty-tab-copy rv-empty-tab-neutral">
      This tab is empty.
    </p>
  );
}

function EmptyBodySurface({
  tabId,
  renderEmptyBody,
}: {
  tabId: string;
  renderEmptyBody?: (tabId: string) => ReactNode;
}) {
  if (!renderEmptyBody) return <NeutralEmptySurface />;
  let body: ReactNode = null;
  try {
    body = renderEmptyBody(tabId);
  } catch {
    return <NeutralEmptySurface />;
  }
  return (
    <PresenterErrorBoundary resetKey={tabId} fallback={<NeutralEmptySurface />}>
      {body}
    </PresenterErrorBoundary>
  );
}

/** Neutral Empty-tab container: no menu; reservation lifecycle surface only. */
export function EmptyTabPanel({
  tabId,
  reservation,
  renderEmptyBody,
  reservationLabel,
  onRetry,
  onCancel,
}: EmptyTabPanelProps) {
  const pending = reservation?.status === 'pending';
  const failed = reservation?.status === 'failed';
  const safeLabel = typeof reservationLabel === 'string' && reservationLabel.trim()
    ? reservationLabel
    : 'content';

  return (
    <section
      className="rv-empty-tab-panel"
      aria-busy={pending || undefined}
    >
      <div className="rv-empty-tab-content">
        <EmptyBodySurface tabId={tabId} renderEmptyBody={renderEmptyBody} />

        {pending ? (
          <div className="rv-empty-tab-reservation" role="status" aria-live="polite">
            <span className="rv-empty-tab-reservation-message">
              Opening {safeLabel}…
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
                Retry {safeLabel}
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
