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
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const screenshots = useScreenshotStore((s) => s.screenshots);

  if (!isRibbonOpen) return null;

  const sorted = toRibbonWorkspaces(workspaces);
  const activeIndex = sorted.findIndex((w) => w.id === activeId);

  return (
    <div className="rv-workspace-carousel">
      <div
        className="rv-workspace-carousel-track"
        style={{ '--carousel-offset': `${-activeIndex * 100}vw` } as React.CSSProperties}
      >
        {sorted.map((w) => (
          <div key={w.id} className="rv-workspace-carousel-slide">
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
