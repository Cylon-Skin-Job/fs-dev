/**
 * Workspace Carousel.
 *
 * One job: render workspace screenshots in a horizontal strip and animate
 * slides when the active workspace changes while the ribbon is open.
 */

import { toRibbonWorkspaces, useWorkspaceStore } from '../state/workspaceStore';
import { useScreenshotStore } from '../state/screenshotStore';
import './WorkspaceCarousel.css';

export function WorkspaceCarousel() {
  const isRibbonOpen = useWorkspaceStore((s) => s.isRibbonOpen);
  const isPreviewOpen = useWorkspaceStore((s) => s.isWorkspacePreviewOpen);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const previewId = useWorkspaceStore((s) => s.previewWorkspaceId);
  const screenshots = useScreenshotStore((s) => s.screenshots);

  if (!isRibbonOpen && !isPreviewOpen) return null;

  const sorted = toRibbonWorkspaces(workspaces);
  const displayId = previewId || activeId;
  const activeIndex = Math.max(0, sorted.findIndex((w) => w.id === displayId));
  const slideCount = Math.max(1, sorted.length);
  const slideWidth = 100 / slideCount;

  return (
    <div className="rv-workspace-carousel">
      <div
        className="rv-workspace-carousel-track"
        style={{
          width: `${slideCount * 100}%`,
          transform: `translateX(${-activeIndex * slideWidth}%)`,
        } as React.CSSProperties}
      >
        {sorted.map((w) => (
          <div
            key={w.id}
            className="rv-workspace-carousel-slide"
            style={{ flexBasis: `${slideWidth}%` }}
          >
            {screenshots[w.id] ? (
              <img
                src={screenshots[w.id]}
                alt={w.label}
                className="rv-workspace-carousel-screenshot"
                draggable={false}
              />
            ) : (
              <div className="rv-workspace-carousel-placeholder">
                <span className="material-symbols-outlined">{w.icon || 'folder'}</span>
                <span>{w.label}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
