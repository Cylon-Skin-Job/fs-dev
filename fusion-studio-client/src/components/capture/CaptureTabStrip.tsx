/**
 * @module CaptureTabStrip
 * @role Tab rail for the capture-viewer, shown when tabs mode is latched.
 *
 * Visual clone of the file-viewer tab row: icon + name + close per tab.
 * Replaces the centered header title; section bar / doc subheader stay put.
 */

import { type KeyboardEvent } from 'react';
import type { DocViewerTab } from '../../types';
import { getFileIcon } from '../../lib/file-utils';
import { CAPTURE_TAB_LABEL } from './captureTabsController';
import './CaptureTabStrip.css';

interface CaptureTabStripProps {
  tabs: DocViewerTab[];
  activeId: string | null;
  captureIcon: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

function tabLabel(tab: DocViewerTab): string {
  return tab.kind === 'capture' ? CAPTURE_TAB_LABEL : (tab.name ?? tab.path ?? '');
}

export function CaptureTabStrip({
  tabs,
  activeId,
  captureIcon,
  onSelect,
  onClose,
}: CaptureTabStripProps) {
  const handleKeyDown = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <div className="rv-capture-tab-strip" role="tablist" aria-label="Open captures">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        const icon = tab.kind === 'capture' ? captureIcon : getFileIcon(tab.extension, tab.name);
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            data-tab-id={tab.id}
            tabIndex={active ? 0 : -1}
            className={`rv-capture-viewer-tab${active ? ' active' : ''}`}
            onKeyDown={handleKeyDown(tab.id)}
            onClick={() => onSelect(tab.id)}
          >
            <span
              className={`material-symbols-outlined rv-capture-tab-icon${tab.kind === 'capture' ? ' rv-capture-tab-icon--view' : ''}`}
              aria-hidden="true"
            >
              {icon}
            </span>
            <span className="rv-capture-tab-name">{tabLabel(tab)}</span>
            <button
              type="button"
              className="rv-capture-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              title={tab.kind === 'capture' ? 'Close capture view' : 'Close tab'}
              aria-label={`${tab.kind === 'capture' ? 'Close capture view' : `Close ${tabLabel(tab)}`}`}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
