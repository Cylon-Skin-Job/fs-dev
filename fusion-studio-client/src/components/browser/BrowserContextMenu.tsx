/**
 * @module BrowserContextMenu
 * @role Right-click / overflow menu for browser views
 */

import React, { useEffect, useRef } from 'react';

export interface MenuItem {
  label: string;
  icon?: string;
  action: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface BrowserContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export const BrowserContextMenu: React.FC<BrowserContextMenuProps> = ({
  x,
  y,
  items,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Clamp position to viewport
  const rect = menuRef.current?.getBoundingClientRect();
  const menuW = rect?.width ?? 180;
  const menuH = rect?.height ?? items.length * 32;
  const posX = Math.min(x, window.innerWidth - menuW - 8);
  const posY = Math.min(y, window.innerHeight - menuH - 8);

  return (
    <div
      ref={menuRef}
      className="rv-browser-context-menu"
      style={{ left: posX, top: posY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="rv-browser-context-separator" />
        ) : (
          <button
            key={i}
            className={`rv-browser-context-item ${item.danger ? 'danger' : ''}`}
            onClick={() => {
              item.action();
              onClose();
            }}
          >
            {item.icon && (
              <span className="material-symbols-outlined rv-browser-context-icon">
                {item.icon}
              </span>
            )}
            <span className="rv-browser-context-label">{item.label}</span>
          </button>
        )
      )}
    </div>
  );
};
