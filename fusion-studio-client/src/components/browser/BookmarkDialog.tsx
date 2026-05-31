/**
 * @module BookmarkDialog
 * @role Popup dialog for adding/editing a bookmark
 */

import React, { useRef, useEffect, useState } from 'react';
import './BookmarkDialog.css';

export interface BookmarkDialogProps {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string, title: string, folder: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

const FOLDER_OPTIONS = ['Bookmarks bar'];

export const BookmarkDialog: React.FC<BookmarkDialogProps> = ({
  url,
  title,
  isOpen,
  onClose,
  onSave,
  anchorRef,
}) => {
  const [name, setName] = useState(title || '');
  const [folder, setFolder] = useState(FOLDER_OPTIONS[0]);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(title || '');
      setFolder(FOLDER_OPTIONS[0]);
    }
  }, [isOpen, title]);

  // Close on outside click (ignore clicks on the anchor element)
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dialogRef.current && dialogRef.current.contains(target)) return;
      if (anchorRef?.current && anchorRef.current.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(url, name.trim(), folder);
    onClose();
  };

  return (
    <div className="rv-bookmark-dialog" ref={dialogRef}>
      <div className="rv-bookmark-dialog-row">
        <span className="material-symbols-outlined rv-bookmark-dialog-icon">star</span>
        <input
          type="text"
          className="rv-bookmark-dialog-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bookmark name"
          autoFocus
        />
      </div>
      <div className="rv-bookmark-dialog-row">
        <span className="material-symbols-outlined rv-bookmark-dialog-icon">folder</span>
        <select
          className="rv-bookmark-dialog-folder"
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
        >
          {FOLDER_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div className="rv-bookmark-dialog-actions">
        <button type="button" className="rv-bookmark-dialog-btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="rv-bookmark-dialog-btn rv-bookmark-dialog-btn--primary" onClick={handleSave}>
          Done
        </button>
      </div>
    </div>
  );
};
