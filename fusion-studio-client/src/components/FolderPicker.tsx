/**
 * @module FolderPicker
 * @role Modal folder browser for selecting a project directory.
 *
 * Tree-based — mirrors the code viewer's FolderNode pattern: click a folder
 * to expand/collapse it inline, children indent to the right. No chevrons,
 * no flat-list navigation. The tree IS the navigation.
 *
 * Self-contained — uses its own state (expanded set, children cache) and
 * communicates via folder:browse / folder:browse_result. No dependency on
 * fileStore or panelStore beyond the WebSocket reference.
 *
 * See docs/FOLDER_PICKER_SPEC.md.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import './FolderPicker.css';

interface BrowseFolder {
  name: string;
  path: string;
  hasChildren: boolean;
  isRepo: boolean;
}

interface FolderPickerProps {
  open: boolean;
  onSelect: (absolutePath: string) => void;
  onCancel: () => void;
  initialPath?: string;
}

let nextSocketId = 1;
const socketIds = new WeakMap<WebSocket, number>();

function getSocketId(ws: WebSocket): number {
  const existing = socketIds.get(ws);
  if (existing) return existing;
  const id = nextSocketId;
  nextSocketId += 1;
  socketIds.set(ws, id);
  return id;
}

// ── Browse helper ──────────────────────────────────────────────────────

function browsePath(ws: WebSocket, dirPath: string): Promise<BrowseFolder[]> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'folder:browse_result' && msg.path === dirPath) {
          ws.removeEventListener('message', handleMessage);
          clearTimeout(timer);
          if (msg.success) {
            resolve(msg.folders ?? []);
          } else {
            reject(new Error(msg.error || 'Browse failed'));
          }
        }
      } catch { /* ignore */ }
    };
    ws.addEventListener('message', handleMessage);
    ws.send(JSON.stringify({ type: 'folder:browse', path: dirPath }));
    const timer = setTimeout(() => {
      ws.removeEventListener('message', handleMessage);
      reject(new Error('Timeout'));
    }, 5000);
  });
}

// ── Folder row (recursive) ─────────────────────────────────────────────

interface FolderRowProps {
  folder: BrowseFolder;
  depth: number;
  ws: WebSocket;
  selectedPath: string | null;
  onSelectPath: (path: string) => void;
  expanded: Set<string>;
  childrenCache: Map<string, BrowseFolder[]>;
  onToggle: (folder: BrowseFolder) => void;
}

function FolderRow({
  folder, depth, ws, selectedPath, onSelectPath,
  expanded, childrenCache, onToggle,
}: FolderRowProps) {
  const isExpanded = expanded.has(folder.path);
  const children = childrenCache.get(folder.path);
  const isSelected = selectedPath === folder.path;
  const paddingLeft = `${0.75 + depth * 1.25}rem`;

  // Icon — same logic as code viewer FolderNode
  let icon: string;
  let iconClass: string;
  if (folder.isRepo) {
    icon = isExpanded ? 'folder_open' : 'source';
    iconClass = 'rv-fp-tree-icon rv-fp-repo';
  } else if (isExpanded) {
    icon = 'folder_open';
    iconClass = 'rv-fp-tree-icon';
  } else if (folder.hasChildren) {
    icon = 'folder';
    iconClass = 'rv-fp-tree-icon rv-fp-folder-filled';
  } else {
    icon = 'folder';
    iconClass = 'rv-fp-tree-icon rv-fp-folder-outline';
  }

  const handleClick = () => {
    // Select this folder
    onSelectPath(folder.path);
    // Toggle expand/collapse
    if (folder.hasChildren) {
      onToggle(folder);
    }
  };

  return (
    <div className="rv-fp-node">
      <div
        className={`rv-fp-tree-item ${isSelected ? 'selected' : ''}`}
        style={{ '--tree-indent': paddingLeft } as React.CSSProperties}
        onClick={handleClick}
      >
        <span className={`material-symbols-outlined ${iconClass}`}>{icon}</span>
        <span className="rv-fp-tree-label">{folder.name}</span>
        {folder.isRepo && <span className="rv-fp-badge">repo</span>}
      </div>
      {isExpanded && children && children.length > 0 && (
        <div className="rv-fp-children">
          {children.map((child) => (
            <FolderRow
              key={child.path}
              folder={child}
              depth={depth + 1}
              ws={ws}
              selectedPath={selectedPath}
              onSelectPath={onSelectPath}
              expanded={expanded}
              childrenCache={childrenCache}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
      {isExpanded && children && children.length === 0 && (
        <div
          className="rv-fp-tree-empty"
          style={{ '--tree-indent': `${0.75 + (depth + 1) * 1.25}rem` } as React.CSSProperties}
        >
          Empty folder
        </div>
      )}
    </div>
  );
}

// ── Main picker ────────────────────────────────────────────────────────

export function FolderPicker({ open, onSelect, onCancel, initialPath = '/' }: FolderPickerProps) {
  const ws = usePanelStore((s) => s.ws);
  if (!open || !ws) return null;

  return (
    <FolderPickerDialog
      key={`${initialPath}:${getSocketId(ws)}`}
      ws={ws}
      onSelect={onSelect}
      onCancel={onCancel}
      initialPath={initialPath}
    />
  );
}

interface FolderPickerDialogProps extends Omit<FolderPickerProps, 'open'> {
  ws: WebSocket;
}

function FolderPickerDialog({
  ws,
  onSelect,
  onCancel,
  initialPath = '/',
}: FolderPickerDialogProps) {
  const [rootFolders, setRootFolders] = useState<BrowseFolder[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Map<string, BrowseFolder[]>>(new Map());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(ws.readyState === WebSocket.OPEN);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load initial path when opening. The wrapper remounts this dialog to reset local state.
  useEffect(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    let cancelled = false;

    browsePath(ws, initialPath)
      .then((folders) => {
        if (cancelled) return;
        setRootFolders(folders);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setRootFolders([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ws, initialPath]);

  // Escape / Enter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && selectedPath) onSelect(selectedPath);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, onSelect, selectedPath]);

  const handleToggle = useCallback(async (folder: BrowseFolder) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const isCurrentlyExpanded = expanded.has(folder.path);
    if (isCurrentlyExpanded) {
      // Collapse
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(folder.path);
        return next;
      });
    } else {
      // Expand — fetch children if not cached
      if (!childrenCache.has(folder.path)) {
        try {
          const children = await browsePath(ws, folder.path);
          setChildrenCache((prev) => new Map(prev).set(folder.path, children));
        } catch (err) {
          console.error('[FolderPicker] Browse failed:', err);
          return;
        }
      }
      setExpanded((prev) => new Set(prev).add(folder.path));
    }
  }, [ws, expanded, childrenCache]);

  // Breadcrumb from initialPath
  const segments = initialPath === '/'
    ? [{ label: '/', path: '/' }]
    : initialPath.split('/').reduce<{ label: string; path: string }[]>((acc, seg, i) => {
        if (i === 0) acc.push({ label: '/', path: '/' });
        else if (seg) {
          const prev = acc[acc.length - 1].path;
          acc.push({ label: seg, path: prev === '/' ? '/' + seg : prev + '/' + seg });
        }
        return acc;
      }, []);

  return (
    <div className="rv-fp-backdrop" onClick={onCancel}>
      <div className="rv-fp" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="rv-fp-header">
          <span className="rv-fp-title">Select Folder</span>
          <button className="rv-fp-close" onClick={onCancel} type="button">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        {/* Breadcrumb — shows the root we started from */}
        <nav className="rv-fp-breadcrumb">
          {segments.map((seg, i) => (
            <span key={seg.path}>
              {i > 0 && <span className="rv-fp-breadcrumb-sep">›</span>}
              <span className="rv-fp-breadcrumb-label">{seg.label}</span>
            </span>
          ))}
        </nav>

        {/* Tree */}
        <div className="rv-fp-list" ref={listRef}>
          {loading && <div className="rv-fp-status">Loading...</div>}
          {error && <div className="rv-fp-status rv-fp-error">{error}</div>}
          {!loading && !error && rootFolders.length === 0 && (
            <div className="rv-fp-status">Empty folder</div>
          )}
          {!loading && rootFolders.map((folder) => (
            <FolderRow
              key={folder.path}
              folder={folder}
              depth={0}
              ws={ws}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
              expanded={expanded}
              childrenCache={childrenCache}
              onToggle={handleToggle}
            />
          ))}
        </div>

        {/* Footer */}
        <footer className="rv-fp-footer">
          <div className="rv-fp-selected-path">
            {selectedPath || 'No folder selected'}
          </div>
          <div className="rv-fp-actions">
            <button className="rv-fp-btn" onClick={onCancel}>Cancel</button>
            <button
              className="rv-fp-btn rv-fp-btn-primary"
              disabled={!selectedPath}
              onClick={() => selectedPath && onSelect(selectedPath)}
            >
              Open
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
