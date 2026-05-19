/**
 * ToolCallBlock — Shared visual shell for all non-text segments.
 *
 * Header (icon + label from catalog) + collapsible content area.
 * Used by both LiveSegmentRenderer and InstantSegmentRenderer.
 */

import './ToolsPanel.css';
import type { SegmentType } from '../types';
import {
  getSegmentVisual,
  getSegmentIcon,
  getSegmentIconColor,
  getSegmentLabelColor,
  buildSegmentLabelWithError,
} from '../lib/catalog-visual';
import { COLLAPSE_DURATION } from '../lib/timing';

interface ToolCallBlockProps {
  type: SegmentType;
  /** Override label (e.g., for grouped blocks showing count) */
  label?: string;
  /** Tool arguments for label building */
  toolArgs?: Record<string, unknown>;
  isError?: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Show shimmer animation on the header */
  shimmer?: boolean;
  /** Override collapse animation duration (ms). Syncs CSS transition with JS sleep under pressure. */
  collapseDuration?: number;
  children?: React.ReactNode;
}

export function ToolCallBlock({
  type,
  label: labelOverride,
  toolArgs,
  isError,
  expanded,
  onToggle,
  shimmer,
  collapseDuration: collapseDurationOverride,
  children,
}: ToolCallBlockProps) {
  const effectiveCollapse = collapseDurationOverride ?? COLLAPSE_DURATION;
  const visual = getSegmentVisual(type);
  const icon = getSegmentIcon(type, isError);
  const iconColor = getSegmentIconColor(type, isError);
  const labelColor = getSegmentLabelColor(type, isError);
  const label = labelOverride || buildSegmentLabelWithError(type, toolArgs, isError);

  const hasContent = !!children;

  return (
    <div className="rv-tool-fade-in">
      {/* Header */}
      <button
        type="button"
        onClick={() => hasContent && onToggle()}
        className="rv-tool-header-btn"
        data-interactive={hasContent ? 'true' : undefined}
        data-expanded={expanded ? 'true' : undefined}
        style={{ '--tool-label-color': labelColor } as React.CSSProperties}
      >
        {icon && (
          <span
            className="material-symbols-outlined rv-tool-icon"
            style={{ '--tool-icon-size': `${visual.iconSize}px`, '--tool-icon-color': iconColor } as React.CSSProperties}
          >
            {icon}
          </span>
        )}
        <span className={`rv-tool-label${shimmer ? ' rv-shimmer-text' : ''}`}
          style={{ '--tool-label-style': visual.labelStyle } as React.CSSProperties}
        >
          {label}
          {hasContent && (
            <span className="material-symbols-outlined rv-tool-arrow-icon">
              arrow_drop_down
            </span>
          )}
        </span>
      </button>

      {/* Content area */}
      {hasContent && (
        <div
          className="rv-tool-content-area"
          data-expanded={expanded ? 'true' : undefined}
          style={{
            '--tool-collapse-ms': `${effectiveCollapse}ms`,
            '--tool-border-w': visual.borderLeft?.width ?? '0px',
            '--tool-border-color': visual.borderLeft?.color ?? 'transparent',
            '--tool-border-pl': visual.borderLeft ? '12px' : '0px',
          } as React.CSSProperties}
        >
          <div
            className="rv-tool-content-body"
            style={{ '--tool-content-color': visual.contentColor } as React.CSSProperties}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
