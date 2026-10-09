/**
 * @module BrowserTabs
 * @role Tab bar for the general web browser
 */

import React from 'react';
import './BrowserTabs.css';

export interface BrowserTab {
  id: string;
  url: string;
  title: string;
}

export interface BrowserTabsProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onAdd: () => void;
}

export const BrowserTabs: React.FC<BrowserTabsProps> = ({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onAdd,
}) => {
  return (
    <div className="rv-browser-tabs">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const displayTitle = tab.title || tab.url || 'New Tab';
        return (
          <button
            key={tab.id}
            type="button"
            className={`rv-browser-tab ${isActive ? 'active' : ''}`}
            onClick={() => onActivate(tab.id)}
            title={displayTitle}
          >
            <span className="rv-browser-tab-title">{displayTitle}</span>
            <button
              type="button"
              className="rv-browser-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              title="Close tab"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </button>
        );
      })}
      <button
        type="button"
        className="rv-browser-new-tab"
        onClick={onAdd}
        title="New tab"
      >
        <span className="material-symbols-outlined">add</span>
      </button>
    </div>
  );
};
