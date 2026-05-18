/**
 * Workspace Carousel.
 *
 * One job: render workspace screenshots in a horizontal strip and animate
 * slides when the active workspace changes while the ribbon is open.
 */

import { useWorkspaceStore } from '../state/workspaceStore';
import { useScreenshotStore } from '../state/screenshotStore';
import './WorkspaceCarousel.css';

export function WorkspaceCarousel() {
  const isRibbonOpen = useWorkspaceStore((s) => s.isRibbonOpen);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const screenshots = useScreenshotStore((s) => s.screenshots);

  if (!isRibbonOpen) return null;

  const sorted = [...workspaces].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeIndex = sorted.findIndex((w) => w.id === activeId);

  return (
    <div className="rv-workspace-carousel">
      <div
        className="rv-workspace-carousel-track"
        style={{
          transform: `translateX(${-activeIndex * 100}vw)`,
          transition: 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
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
