/**
 * @module WorkspaceRibbon
 * @role Glass dropdown ribbon for switching, adding, and removing workspaces.
 *
 * Drops down from beneath the header when the user clicks the centered
 * workspace title. Shows workspace icons centered with names beneath.
 *
 * Visual language borrows from the capture-viewer bottom ribbon:
 * diagonal white-alpha gradient, blurred backdrop, thin border.
 */

import { useRef, useState, type DragEvent, type MouseEvent } from 'react';
import {
  toHiddenRibbonWorkspaces,
  toRibbonWorkspaces,
  useWorkspaceStore,
} from '../state/workspaceStore';
import { useScreenshotStore } from '../state/screenshotStore';
import { Icon } from './Icon';
import { WorkspaceRibbonAddMenu } from './WorkspaceRibbonAddMenu';
import type { Workspace } from '../types';
import './WorkspaceRibbon.css';

export function WorkspaceRibbon() {
  const [draggingWorkspaceId, setDraggingWorkspaceId] = useState<string | null>(null);
  const [dragOverWorkspaceId, setDragOverWorkspaceId] = useState<string | null>(null);
  const [previewWorkspaceIds, setPreviewWorkspaceIds] = useState<string[] | null>(null);
  const ribbonItemsRef = useRef<HTMLDivElement | null>(null);
  const didDragRef = useRef(false);
  const dragOffsetXRef = useRef(0);
  const dragWidthRef = useRef(0);
  const lastDragClientXRef = useRef(0);
  const isOpen = useWorkspaceStore((s) => s.isRibbonOpen);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const previewId = useWorkspaceStore((s) => s.previewWorkspaceId);
  const closeRibbon = useWorkspaceStore((s) => s.closeRibbon);
  const openAddModal = useWorkspaceStore((s) => s.openAddModal);
  const openCreateModal = useWorkspaceStore((s) => s.openCreateModal);
  const requestSwitch = useWorkspaceStore((s) => s.requestSwitch);
  const requestRemoveFromRibbon = useWorkspaceStore((s) => s.requestRemoveFromRibbon);
  const requestAddToRibbon = useWorkspaceStore((s) => s.requestAddToRibbon);
  const requestRibbonReorder = useWorkspaceStore((s) => s.requestRibbonReorder);

  const screenshots = useScreenshotStore((s) => s.screenshots);
  const sorted = toRibbonWorkspaces(workspaces);
  const hiddenWorkspaces = toHiddenRibbonWorkspaces(workspaces);
  const sortedById = new Map(sorted.map((workspace) => [workspace.id, workspace]));
  const previewItems = previewWorkspaceIds
    ? previewWorkspaceIds.map((id) => sortedById.get(id)).filter((workspace): workspace is Workspace => Boolean(workspace))
    : sorted;
  const highlightedId = previewId || activeId;

  const onItemClick = (w: Workspace) => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    closeRibbon();
    if (w.id === activeId) {
      return;
    }
    requestSwitch(w.id);
  };

  const onRemoveFromRibbonClick = (e: MouseEvent, w: Workspace) => {
    e.stopPropagation();
    requestRemoveFromRibbon(w.id);
  };

  const onItemDragStart = (event: DragEvent<HTMLDivElement>, w: Workspace) => {
    didDragRef.current = true;
    setDraggingWorkspaceId(w.id);
    setDragOverWorkspaceId(null);
    setPreviewWorkspaceIds(sorted.map((workspace) => workspace.id));
    const rect = event.currentTarget.getBoundingClientRect();
    dragOffsetXRef.current = event.clientX - rect.left;
    dragWidthRef.current = rect.width;
    lastDragClientXRef.current = event.clientX;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', w.id);
  };

  const onItemDragOver = (event: DragEvent<HTMLDivElement>, w: Workspace) => {
    if (!draggingWorkspaceId || draggingWorkspaceId === w.id) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverWorkspaceId(w.id);
  };

  const getReorderedIds = (sourceId: string, insertBeforeId: string | null) => {
    const ids = sorted.map((workspace) => workspace.id);
    if (!ids.includes(sourceId)) return;

    const nextIds = ids.filter((id) => id !== sourceId);
    const insertIndex = insertBeforeId ? nextIds.indexOf(insertBeforeId) : nextIds.length;
    if (insertIndex < 0) return;

    nextIds.splice(insertIndex, 0, sourceId);
    return nextIds;
  };

  const requestReorder = (nextIds: string[] | undefined) => {
    const ids = sorted.map((workspace) => workspace.id);
    if (!nextIds || nextIds.join('\u0000') === ids.join('\u0000')) return;
    requestRibbonReorder(nextIds);
  };

  const getInsertBeforeId = (event: DragEvent<HTMLDivElement>, sourceId: string) => {
    if (!ribbonItemsRef.current) return null;

    const itemElements = Array.from(
      ribbonItemsRef.current.querySelectorAll<HTMLElement>('[data-workspace-id]')
    ).filter((element) => element.dataset.workspaceId !== sourceId);
    if (itemElements.length === 0) return null;

    const movingRight = event.clientX >= lastDragClientXRef.current;
    lastDragClientXRef.current = event.clientX;

    const draggedLeft = event.clientX - dragOffsetXRef.current;
    const draggedRight = draggedLeft + dragWidthRef.current;

    if (movingRight) {
      let crossedIndex = -1;
      itemElements.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        if (draggedRight > rect.left + rect.width / 2) {
          crossedIndex = index;
        }
      });
      return itemElements[crossedIndex + 1]?.dataset.workspaceId || null;
    }

    const insertBefore = itemElements.find((element) => {
      const rect = element.getBoundingClientRect();
      return draggedLeft < rect.left + rect.width / 2;
    });

    return insertBefore?.dataset.workspaceId || null;
  };

  const onItemDrop = (event: DragEvent<HTMLDivElement>, target: Workspace) => {
    event.preventDefault();
    event.stopPropagation();

    const sourceId = draggingWorkspaceId || event.dataTransfer.getData('text/plain');
    setDraggingWorkspaceId(null);
    setDragOverWorkspaceId(null);
    didDragRef.current = Boolean(sourceId && sourceId !== target.id);

    if (!sourceId) return;
    if (sourceId === target.id) {
      requestReorder(previewWorkspaceIds || undefined);
      setPreviewWorkspaceIds(null);
      return;
    }

    const targetRect = event.currentTarget.getBoundingClientRect();
    const dropAfterTarget = event.clientX > targetRect.left + targetRect.width / 2;
    if (!dropAfterTarget) {
      requestReorder(previewWorkspaceIds || getReorderedIds(sourceId, target.id));
      setPreviewWorkspaceIds(null);
      return;
    }

    const idsWithoutSource = sorted.map((workspace) => workspace.id).filter((id) => id !== sourceId);
    const nextTargetId = idsWithoutSource[idsWithoutSource.indexOf(target.id) + 1] || null;
    requestReorder(previewWorkspaceIds || getReorderedIds(sourceId, nextTargetId));
    setPreviewWorkspaceIds(null);
  };

  const onRibbonItemsDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!draggingWorkspaceId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const insertBeforeId = getInsertBeforeId(event, draggingWorkspaceId);
    const nextIds = getReorderedIds(draggingWorkspaceId, insertBeforeId);
    if (!nextIds) return;

    setDragOverWorkspaceId(insertBeforeId);
    setPreviewWorkspaceIds((currentIds) => {
      if (currentIds && currentIds.join('\u0000') === nextIds.join('\u0000')) return currentIds;
      return nextIds;
    });
  };

  const onRibbonItemsDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const sourceId = draggingWorkspaceId || event.dataTransfer.getData('text/plain');
    setDraggingWorkspaceId(null);
    setDragOverWorkspaceId(null);
    didDragRef.current = Boolean(sourceId);

    if (!sourceId || !ribbonItemsRef.current) return;

    const insertBeforeId = getInsertBeforeId(event, sourceId);
    requestReorder(previewWorkspaceIds || getReorderedIds(sourceId, insertBeforeId));
    setPreviewWorkspaceIds(null);
  };

  const onItemDragEnd = () => {
    setDraggingWorkspaceId(null);
    setDragOverWorkspaceId(null);
    setPreviewWorkspaceIds(null);
  };

  return (
    <>
      {isOpen && (
        <div className="rv-workspace-ribbon-scrim" onClick={closeRibbon} />
      )}
      <div
        className={`rv-workspace-ribbon ${isOpen ? 'is-open' : ''}`}
        aria-hidden={!isOpen}
      >
        <div className="rv-workspace-ribbon-grid">
          <div
            ref={ribbonItemsRef}
            className="rv-workspace-ribbon-items"
            onDragOver={onRibbonItemsDragOver}
            onDrop={onRibbonItemsDrop}
          >
            {previewItems.map((w) => (
              <div
                key={w.id}
                data-workspace-id={w.id}
                className={`rv-workspace-ribbon-item ${w.id === highlightedId ? 'is-active' : ''} ${w.id === draggingWorkspaceId ? 'is-dragging' : ''} ${w.id === dragOverWorkspaceId ? 'is-drop-target' : ''}`}
                onClick={() => onItemClick(w)}
                draggable
                onDragStart={(event) => onItemDragStart(event, w)}
                onDragOver={(event) => onItemDragOver(event, w)}
                onDrop={(event) => onItemDrop(event, w)}
                onDragEnd={onItemDragEnd}
                title={w.label}
              >
                {screenshots[w.id] ? (
                  <img
                    src={screenshots[w.id]}
                    alt={w.label}
                    className="rv-workspace-ribbon-item-thumb"
                    draggable={false}
                  />
                ) : (
                  <Icon
                    name={w.icon || 'folder'}
                    className="rv-workspace-ribbon-item-icon"
                  />
                )}
                <span className="rv-workspace-ribbon-item-label">{w.label}</span>
                <button
                  className="rv-workspace-ribbon-item-remove"
                  onClick={(e) => onRemoveFromRibbonClick(e, w)}
                  onDragStart={(event) => event.preventDefault()}
                  title="Remove from ribbon"
                  aria-label="Remove from ribbon"
                  type="button"
                >
                  <span className="material-symbols-outlined">cancel</span>
                </button>
              </div>
            ))}
          </div>
          <WorkspaceRibbonAddMenu
            hiddenWorkspaces={hiddenWorkspaces}
            ribbonOpen={isOpen}
            closeRibbon={closeRibbon}
            openAddModal={openAddModal}
            openCreateModal={openCreateModal}
            requestAddToRibbon={requestAddToRibbon}
          />
        </div>
      </div>
    </>
  );
}
