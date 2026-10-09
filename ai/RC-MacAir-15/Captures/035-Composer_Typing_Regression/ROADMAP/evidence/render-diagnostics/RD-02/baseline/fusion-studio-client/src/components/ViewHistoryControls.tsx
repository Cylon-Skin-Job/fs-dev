interface ViewHistoryControlsProps {
  onBack: () => void;
  onForward: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
}

/** Shared 80px-offset content navigation used by non-tabbed views. */
export function ViewHistoryControls({
  onBack,
  onForward,
  canGoBack,
  canGoForward,
}: ViewHistoryControlsProps) {
  return (
    <div className="rv-view-history-controls" aria-label="Content history">
      <button
        type="button"
        className="rv-view-history-control"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Back"
        title="Back"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <button
        type="button"
        className="rv-view-history-control"
        onClick={onForward}
        disabled={!canGoForward}
        aria-label="Forward"
        title="Forward"
      >
        <span className="material-symbols-outlined">arrow_forward</span>
      </button>
    </div>
  );
}
