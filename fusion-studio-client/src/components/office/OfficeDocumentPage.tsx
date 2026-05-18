/**
 * @module OfficeDocumentPage
 * @role Full WYSIWYG document editor for markdown files in office-viewer
 *
 * Replaces the Chunk 1 textarea placeholder with a Milkdown Crepe editor.
 * Auto-save (3s debounce), manual save (Ctrl+S), dirty tracking, sibling ribbon.
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Crepe } from '@milkdown/crepe';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame-dark.css';
import {
  headingSchema,
  wrapInHeadingCommand,
} from '@milkdown/kit/preset/commonmark';
import { commandsCtx, editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { undo, redo } from '@milkdown/prose/history';
import { useFileDataStore } from '../../state/fileDataStore';
import type { FileWithContent, SaveReason } from '../../state/fileDataStore';
import { useRecentDocsStore } from '../../state/recentDocsStore';
import { usePanelStore } from '../../state/panelStore';
import { OfficeDocumentTile } from './OfficeDocumentTile';
import { copyResourcePath, resolveAbsolutePath } from '../../lib/resource-path';
import { showToast } from '../../lib/toast';
import './OfficeDocumentPage.css';
import {
  parseDocumentSettings,
  serializeDocumentSettings,
  DEFAULT_SETTINGS,
  type DocumentSettings,
  getFontCss,
} from '../../lib/front-matter';
import {
  spanStyleMark,
  convertHtmlSpansToMarks,
  convertMarksToHtmlSpans,
  createAdjustSpanStyleCommand,
  emLabelPlugin,
} from '../../lib/milkdown-span-style';

const PANEL = 'office-viewer';

type PendingNavigation =
  | { type: 'back' }
  | { type: 'file'; path: string; folder: string };

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

interface OfficeDocumentPageProps {
  file: FileWithContent;
  folder: string;
  folderName?: string;
  onBack: () => void;
  onOpenFile: (path: string, folder: string) => void;
}

export function OfficeDocumentPage({
  file,
  folder: _folder,
  folderName,
  onBack,
  onOpenFile,
}: OfficeDocumentPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<'docx' | 'pdf' | null>(null);
  const [zoom, setZoom] = useState(1);
  // Navigation is non-blocking; dirty content is saved in the background.
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'versions' | 'files'>('none');
  const [docSettings, setDocSettings] = useState<DocumentSettings>(DEFAULT_SETTINGS);
  const [marginsMenuOpen, setMarginsMenuOpen] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const marginsMenuRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number | null>(null);
  const checkpointDueRef = useRef(false);
  const bodyRef = useRef<string>('');
  const initCompleteRef = useRef(false);

  const saveFile = useFileDataStore((s) => s.saveFile);
  const setDirty = useFileDataStore((s) => s.setDirty);
  const isSaving = useFileDataStore((s) => s.pendingSaves.has(`${PANEL}:${file.path}`));
  const contents = useFileDataStore((s) => s.contents);

  const recentDocs = useRecentDocsStore((s) => s.recentDocs);
  const highlightedPath = useRecentDocsStore((s) => s.highlightedPath);
  const previewSelect = useRecentDocsStore((s) => s.previewSelect);
  const cancelPreviewSelect = useRecentDocsStore((s) => s.cancelPreviewSelect);
  const loadRecentDocs = useRecentDocsStore((s) => s.loadRecentDocs);
  const workspaceId = usePanelStore((s) => s.activeWorkspaceId);

  // Parse front matter whenever file content changes
  const parsed = useMemo(() => parseDocumentSettings(file.content), [file.content]);

  useEffect(() => {
    setDocSettings(parsed.settings);
    bodyRef.current = parsed.body;
  }, [parsed]);

  // Initialize Crepe editor
  useEffect(() => {
    if (!containerRef.current) return;
    initCompleteRef.current = false;

    const materialIcon = (name: string) =>
      `<span class="material-symbols-outlined" style="font-size:18px">${name}</span>`;

    const isHeading = (ctx: any, level: number) => {
      const view = ctx.get(editorViewCtx);
      const { $from } = view.state.selection;
      const node = $from.parent;
      return node.type === headingSchema.type(ctx) && node.attrs.level === level;
    };

    const toggleHeading = (ctx: any, level: number) => {
      const commands = ctx.get(commandsCtx);
      if (isHeading(ctx, level)) {
        commands.call(wrapInHeadingCommand.key, 0);
      } else {
        commands.call(wrapInHeadingCommand.key, level);
      }
    };

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: parsed.body,
      featureConfigs: {
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            h1: null,
            h2: null,
            h3: null,
            h4: null,
            h5: null,
            h6: null,
          },
        },
        [Crepe.Feature.Toolbar]: {
          buildToolbar: (builder) => {
            // Replace formatting group icons with Material Symbols
            const formatting = builder.getGroup('formatting');
            formatting.group.items.forEach((item: any) => {
              if (item.key === 'bold') item.icon = materialIcon('format_bold');
              if (item.key === 'italic') item.icon = materialIcon('format_italic');
              if (item.key === 'strikethrough') item.icon = materialIcon('format_strikethrough');
            });

            // Add heading items before bold
            formatting.group.items.unshift(
              {
                key: 'h1',
                icon: materialIcon('format_h1'),
                active: (ctx: any) => isHeading(ctx, 1),
                onRun: (ctx: any) => toggleHeading(ctx, 1),
              },
              {
                key: 'h2',
                icon: materialIcon('format_h2'),
                active: (ctx: any) => isHeading(ctx, 2),
                onRun: (ctx: any) => toggleHeading(ctx, 2),
              },
              {
                key: 'h3',
                icon: materialIcon('format_h3'),
                active: (ctx: any) => isHeading(ctx, 3),
                onRun: (ctx: any) => toggleHeading(ctx, 3),
              }
            );

            // Add inline font-size +/- to the formatting group
            formatting.group.items.push(
              {
                key: 'spanStyleDec',
                icon: '<span data-span-style="dec" class="material-symbols-outlined" style="font-size:18px">remove</span>',
                active: () => false,
                onRun: (ctx: any) => {
                  const view = ctx.get(editorViewCtx);
                  createAdjustSpanStyleCommand(-0.1)(view.state, view.dispatch);
                },
              },
              {
                key: 'spanStyleInc',
                icon: '<span data-span-style="inc" class="material-symbols-outlined" style="font-size:18px">add</span>',
                active: () => false,
                onRun: (ctx: any) => {
                  const view = ctx.get(editorViewCtx);
                  createAdjustSpanStyleCommand(0.1)(view.state, view.dispatch);
                },
              }
            );

            // Replace function group icons with Material Symbols
            const func = builder.getGroup('function');
            func.group.items.forEach((item: any) => {
              if (item.key === 'code') item.icon = materialIcon('code');
              if (item.key === 'link') item.icon = materialIcon('link');
              if (item.key === 'latex') item.icon = materialIcon('functions');
            });
          },
        },
      },
    });

    // Register custom span-style mark and live em-label plugin
    crepe.editor.use(spanStyleMark);
    crepe.editor.use(emLabelPlugin);

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
        if (!initCompleteRef.current) {
          bodyRef.current = markdown;
          return;
        }
        if (markdown !== bodyRef.current) {
          setIsDirty(true);
          setDirty(PANEL, file.path, true);

          // Track session start for checkpoint timer
          if (sessionStartRef.current === null) {
            sessionStartRef.current = Date.now();
          }

          // Reset auto-save debounce
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          autoSaveTimerRef.current = setTimeout(() => {
            const reason: SaveReason = checkpointDueRef.current ? 'checkpoint' : 'autosave';
            handleSaveRef.current({ reason });
          }, 500);
        }
      });
    });

    crepe.create().then(() => {
      crepeRef.current = crepe;
      // Post-process: fold raw HTML span nodes into spanStyle marks
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const doc = view.state.doc;
        const transformed = convertHtmlSpansToMarks(doc);
        if (transformed !== doc) {
          const tr = view.state.tr;
          tr.replaceWith(0, doc.content.size, transformed.content);
          view.dispatch(tr);
        }
        // Sync bodyRef with the editor's actual markdown so the dirty
        // listener doesn't flag the post-processing transform as a change.
        const serializer = ctx.get(serializerCtx);
        bodyRef.current = serializer(view.state.doc);
      });
      initCompleteRef.current = true;
    });

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      crepe.destroy();
      crepeRef.current = null;
    };
  }, [file.path, file.content]);

  useEffect(() => {
    if (workspaceId) {
      loadRecentDocs(workspaceId);
    }
  }, [workspaceId, loadRecentDocs]);

  useEffect(() => {
    const fileData = useFileDataStore.getState();
    for (const doc of recentDocs) {
      const key = `${doc.panel}:${doc.path}`;
      if (!(key in fileData.contents)) {
        fileData.requestContent(doc.panel, doc.path);
      }
    }
  }, [recentDocs]);

  // Use a ref for handleSave to avoid stale closures in the Crepe listener
  const handleSaveRef = useRef<(options?: { notify?: boolean; reason?: SaveReason; milestone?: string }) => Promise<void>>(async () => {});

  const getSerializedMarkdown = useCallback(async (): Promise<string> => {
    if (!crepeRef.current) return '';
    return crepeRef.current.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const doc = view.state.doc;
      const transformed = convertMarksToHtmlSpans(doc);
      const serializer = ctx.get(serializerCtx);
      return serializer(transformed);
    });
  }, []);

  const handleSave = useCallback(async (options?: { notify?: boolean; reason?: SaveReason; milestone?: string }) => {
    if (!crepeRef.current) return;
    if (isSaving) {
      if (options?.notify) {
        showToast('Save already in progress...');
      }
      return;
    }

    try {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings);
      const reason = checkpointDueRef.current ? 'checkpoint' : (options?.reason ?? 'autosave');
      saveFile(PANEL, file.path, fullContent, reason, options?.milestone);
      setIsDirty(false);
      setDirty(PANEL, file.path, false);
      sessionStartRef.current = null;
      checkpointDueRef.current = false;
      if (options?.notify) {
        showToast('Saving document...');
      }
    } catch (error) {
      showToast(`Save failed: ${getErrorMessage(error)}`);
      throw error;
    }
  }, [file.path, isSaving, saveFile, setDirty, docSettings, getSerializedMarkdown]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const handleExport = useCallback(async (format: 'docx' | 'pdf') => {
    if (!window.electronAPI?.exportDocument) {
      showToast('Export is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;

    setExportingFormat(format);
    try {
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';

      // Milestone save: flush dirty content first, then commit
      if (isDirty) {
        saveFile(PANEL, file.path, fullContent, 'autosave');
        setIsDirty(false);
        setDirty(PANEL, file.path, false);
      }
      const milestone = format === 'pdf' ? 'export_pdf' : 'export_docx';
      saveFile(PANEL, file.path, fullContent, 'milestone', milestone);

      const result = await window.electronAPI.exportDocument({
        sourceType: 'document',
        sourceFormat: 'markdown',
        format,
        content: markdown,
        filename: baseName,
      });

      if (!result.success) {
        showToast(`Export failed: ${result.error}`);
        return;
      }

      const byteChars = atob(result.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        bytes[i] = byteChars.charCodeAt(i);
      }

      const mimeType =
        format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      const blob = new Blob([bytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(`Export failed: ${getErrorMessage(error)}`);
    } finally {
      setExportingFormat(null);
    }
  }, [file.name, isDirty, saveFile, setDirty, docSettings, getSerializedMarkdown]);

  const handlePrint = useCallback(async () => {
    if (!window.electronAPI?.printDocument) {
      showToast('Print is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;
    try {
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';

      // Milestone save: flush dirty content first, then commit
      if (isDirty) {
        saveFile(PANEL, file.path, fullContent, 'autosave');
        setIsDirty(false);
        setDirty(PANEL, file.path, false);
      }
      saveFile(PANEL, file.path, fullContent, 'milestone', 'print');

      const result = await window.electronAPI.printDocument({
        content: markdown,
        filename: baseName,
      });
      if (!result.success) {
        showToast(`Print failed: ${result.error}`);
      }
    } catch (error) {
      showToast(`Print failed: ${getErrorMessage(error)}`);
    }
  }, [file.name, isDirty, saveFile, setDirty, docSettings, getSerializedMarkdown]);

  const handleSendEmail = useCallback(async (format: 'docx' | 'pdf' | 'markdown') => {
    if (!window.electronAPI?.sendDocumentEmail) {
      showToast('Email sending is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;

    setExportMenuOpen(false);
    setExportingFormat(format === 'markdown' ? null : format);
    try {
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';

      // Milestone save: flush dirty content first, then commit
      if (isDirty) {
        saveFile(PANEL, file.path, fullContent, 'autosave');
        setIsDirty(false);
        setDirty(PANEL, file.path, false);
      }
      const milestoneMap = { docx: 'send_docx', pdf: 'send_pdf', markdown: 'send_markdown' };
      saveFile(PANEL, file.path, fullContent, 'milestone', milestoneMap[format]);

      const result = await window.electronAPI.sendDocumentEmail({
        format,
        content: markdown,
        filename: baseName,
      });

      if (!result.success) {
        showToast(`Send failed: ${result.error}`);
        return;
      }

      showToast('Opening Mail…');
    } catch (error) {
      showToast(`Send failed: ${getErrorMessage(error)}`);
    } finally {
      setExportingFormat(null);
    }
  }, [file.name, isDirty, saveFile, setDirty, docSettings, getSerializedMarkdown]);

  const runNavigation = useCallback((navigation: PendingNavigation) => {
    if (navigation.type === 'back') {
      onBack();
      return;
    }
    onOpenFile(navigation.path, navigation.folder);
  }, [onBack, onOpenFile]);

  const requestNavigation = useCallback((navigation: PendingNavigation) => {
    cancelPreviewSelect();

    // Flush any pending autosave timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // If dirty, fire a background save and navigate immediately
    if (isDirty && !isSaving && crepeRef.current) {
      handleSaveRef.current({ reason: 'autosave' }).catch(() => {});
    }

    runNavigation(navigation);
  }, [isDirty, isSaving, runNavigation, cancelPreviewSelect]);

  // Ctrl+S handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave({ notify: true, reason: 'manual' });
        return;
      }
      if (e.key === 'Escape') {
        requestNavigation({ type: 'back' });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, requestNavigation]);

  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Checkpoint timer: every 60s check if 30min of active editing elapsed
  useEffect(() => {
    const interval = setInterval(() => {
      if (sessionStartRef.current && isDirty && !checkpointDueRef.current) {
        if (Date.now() - sessionStartRef.current >= 30 * 60 * 1000) {
          checkpointDueRef.current = true;
        }
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [isDirty]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  // Close margins dropdown on outside click
  useEffect(() => {
    if (!marginsMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (marginsMenuRef.current && !marginsMenuRef.current.contains(e.target as Node)) {
        setMarginsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [marginsMenuOpen]);

  return (
    <div className="rv-office-document-page">
      {/* Topbar */}
      <div className="rv-office-document-topbar">
        <button
          className="rv-office-document-back"
          onClick={() => requestNavigation({ type: 'back' })}
          title="Back"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="rv-office-document-filename">
          {folderName ? `${folderName} / ${file.name}` : file.name}
          {isDirty ? <span className="rv-office-document-dirty">Unsaved</span> : null}
        </span>
        <div className="rv-office-document-actions">
          <button
            className="rv-office-document-action"
            onClick={() => copyResourcePath(PANEL, file.path)}
            title="Copy path"
          >
            <span className="material-symbols-outlined">link_2</span>
          </button>
          <button
            className="rv-office-document-action"
            onClick={() => {
              const absPath = resolveAbsolutePath(PANEL, file.path);
              if (absPath) {
                window.dispatchEvent(new CustomEvent('fusion:chat-insert', { detail: absPath }));
                showToast('Path sent to chat');
              } else {
                showToast('Path not available');
              }
            }}
            title="Send path to chat"
          >
            <span className="material-symbols-outlined">chat_paste_go</span>
          </button>
          <div className="rv-office-export-menu" ref={exportMenuRef}>
            <button
              className="rv-office-document-action"
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={exportingFormat !== null}
              title="Export"
            >
              <span className={`material-symbols-outlined${exportingFormat !== null ? ' rv-office-spin' : ''}`}>
                {exportingFormat !== null ? 'progress_activity' : 'bubble'}
              </span>
            </button>
            {exportMenuOpen && (
              <div className="rv-office-export-dropdown">
                <div className="rv-office-export-row">
                  <button className="rv-office-export-option" disabled={exportingFormat !== null}>
                    <span className="material-symbols-outlined">description</span>
                    Export DOCX
                    <span className="material-symbols-outlined rv-office-export-chevron">chevron_right</span>
                  </button>
                  <div className="rv-office-export-submenu">
                    <button
                      className="rv-office-export-submenu-option"
                      onClick={() => { setExportMenuOpen(false); handleSendEmail('docx'); }}
                      disabled={exportingFormat !== null}
                    >
                      <span className="material-symbols-outlined">attach_email</span>
                      Email
                    </button>
                    <button
                      className="rv-office-export-submenu-option"
                      onClick={() => { setExportMenuOpen(false); handleExport('docx'); }}
                      disabled={exportingFormat !== null}
                    >
                      <span className="material-symbols-outlined">drive_file_move</span>
                      Folder
                    </button>
                  </div>
                </div>
                <div className="rv-office-export-row">
                  <button className="rv-office-export-option" disabled={exportingFormat !== null}>
                    <span className="material-symbols-outlined">picture_as_pdf</span>
                    Export PDF
                    <span className="material-symbols-outlined rv-office-export-chevron">chevron_right</span>
                  </button>
                  <div className="rv-office-export-submenu">
                    <button
                      className="rv-office-export-submenu-option"
                      onClick={() => { setExportMenuOpen(false); handleSendEmail('pdf'); }}
                      disabled={exportingFormat !== null}
                    >
                      <span className="material-symbols-outlined">attach_email</span>
                      Email
                    </button>
                    <button
                      className="rv-office-export-submenu-option"
                      onClick={() => { setExportMenuOpen(false); handleExport('pdf'); }}
                      disabled={exportingFormat !== null}
                    >
                      <span className="material-symbols-outlined">drive_file_move</span>
                      Folder
                    </button>
                  </div>
                </div>
                <div className="rv-office-export-divider" />
                <button
                  className="rv-office-export-option"
                  onClick={() => { setExportMenuOpen(false); handlePrint(); }}
                >
                  <span className="material-symbols-outlined">print</span>
                  Preview PDF
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="rv-office-document-spacer" />
        <button
          className={`rv-office-document-action${sidePanel === 'versions' ? ' rv-office-document-action--active' : ''}${sidePanel !== 'none' ? ' rv-office-document-action--floating' : ''}`}
          onClick={() => setSidePanel((p) => p === 'versions' ? 'none' : 'versions')}
          title="Version history"
        >
          <span className="material-symbols-outlined">browse_gallery</span>
        </button>
        <button
          className={`rv-office-document-action${sidePanel === 'files' ? ' rv-office-document-action--active' : ''}${sidePanel !== 'none' ? ' rv-office-document-action--floating' : ''}`}
          onClick={() => setSidePanel((p) => p === 'files' ? 'none' : 'files')}
          title="Recent documents"
        >
          <span className="material-symbols-outlined">filter_none</span>
        </button>
      </div>

      <div className="rv-office-document-body">
        {/* Permanent toolbar */}
        <div className="rv-office-document-toolbar">
          <button
            className="rv-office-document-toolbar-btn"
            onClick={() => crepeRef.current?.editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              undo(view.state, view.dispatch);
            })}
            title="Undo"
          >
            <span className="material-symbols-outlined">undo</span>
          </button>
          <button
            className="rv-office-document-toolbar-btn"
            onClick={() => crepeRef.current?.editor.action((ctx) => {
              const view = ctx.get(editorViewCtx);
              redo(view.state, view.dispatch);
            })}
            title="Redo"
          >
            <span className="material-symbols-outlined">redo</span>
          </button>
          <div className="rv-office-document-toolbar-divider" />
          <select
            className="rv-office-document-toolbar-select"
            value={docSettings.font.family}
            onChange={(e) => {
              const family = e.target.value;
              setDocSettings((s) => ({ ...s, font: { ...s.font, family } }));
              setIsDirty(true);
              setDirty(PANEL, file.path, true);
            }}
            title="Font"
          >
            <option value="sans">Sans Serif</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
            <option value="arial">Arial</option>
            <option value="georgia">Georgia</option>
            <option value="courier">Courier New</option>
          </select>
          <div className="rv-office-document-toolbar-divider" />
          <button
            className="rv-office-document-toolbar-btn"
            onClick={() => {
              setDocSettings((s) => ({ ...s, font: { ...s.font, size: Math.max(8, s.font.size - 1) } }));
              setIsDirty(true);
              setDirty(PANEL, file.path, true);
            }}
            title="Decrease font size"
          >
            <span className="material-symbols-outlined">remove</span>
          </button>
          <span className="rv-office-document-toolbar-fontsize">{docSettings.font.size}</span>
          <button
            className="rv-office-document-toolbar-btn"
            onClick={() => {
              setDocSettings((s) => ({ ...s, font: { ...s.font, size: Math.min(72, s.font.size + 1) } }));
              setIsDirty(true);
              setDirty(PANEL, file.path, true);
            }}
            title="Increase font size"
          >
            <span className="material-symbols-outlined">add</span>
          </button>
          <div className="rv-office-document-toolbar-divider" />
          <button
            className={`rv-office-document-toolbar-btn${docSettings.alignment === 'left' ? ' rv-office-toolbar-btn--active' : ''}`}
            onClick={() => {
              setDocSettings((s) => ({ ...s, alignment: 'left' }));
              setIsDirty(true);
              setDirty(PANEL, file.path, true);
            }}
            title="Align left"
          >
            <span className="material-symbols-outlined">format_align_left</span>
          </button>
          <button
            className={`rv-office-document-toolbar-btn${docSettings.alignment === 'center' ? ' rv-office-toolbar-btn--active' : ''}`}
            onClick={() => {
              setDocSettings((s) => ({ ...s, alignment: 'center' }));
              setIsDirty(true);
              setDirty(PANEL, file.path, true);
            }}
            title="Align center"
          >
            <span className="material-symbols-outlined">format_align_center</span>
          </button>
          <button
            className={`rv-office-document-toolbar-btn${docSettings.alignment === 'right' ? ' rv-office-toolbar-btn--active' : ''}`}
            onClick={() => {
              setDocSettings((s) => ({ ...s, alignment: 'right' }));
              setIsDirty(true);
              setDirty(PANEL, file.path, true);
            }}
            title="Align right"
          >
            <span className="material-symbols-outlined">format_align_right</span>
          </button>
          <button
            className={`rv-office-document-toolbar-btn${docSettings.alignment === 'justify' ? ' rv-office-toolbar-btn--active' : ''}`}
            onClick={() => {
              setDocSettings((s) => ({ ...s, alignment: 'justify' }));
              setIsDirty(true);
              setDirty(PANEL, file.path, true);
            }}
            title="Justify"
          >
            <span className="material-symbols-outlined">format_align_justify</span>
          </button>
          <div className="rv-office-document-toolbar-divider" />
          <div className="rv-office-margins-menu" ref={marginsMenuRef}>
            <button
              className={`rv-office-document-toolbar-btn${marginsMenuOpen ? ' rv-office-toolbar-btn--active' : ''}`}
              onClick={() => setMarginsMenuOpen((v) => !v)}
              title="Page margins"
            >
              <span className="material-symbols-outlined">border_outer</span>
            </button>
            {marginsMenuOpen && (
              <div className="rv-office-margins-dropdown">
                <div className="rv-office-margins-row">
                  <label>Top</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={docSettings.margins.top}
                    onChange={(e) => {
                      const top = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setDocSettings((s) => ({ ...s, margins: { ...s.margins, top } }));
                      setIsDirty(true);
                      setDirty(PANEL, file.path, true);
                    }}
                  />
                </div>
                <div className="rv-office-margins-row">
                  <label>Bottom</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={docSettings.margins.bottom}
                    onChange={(e) => {
                      const bottom = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setDocSettings((s) => ({ ...s, margins: { ...s.margins, bottom } }));
                      setIsDirty(true);
                      setDirty(PANEL, file.path, true);
                    }}
                  />
                </div>
                <div className="rv-office-margins-row">
                  <label>Left</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={docSettings.margins.left}
                    onChange={(e) => {
                      const left = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setDocSettings((s) => ({ ...s, margins: { ...s.margins, left } }));
                      setIsDirty(true);
                      setDirty(PANEL, file.path, true);
                    }}
                  />
                </div>
                <div className="rv-office-margins-row">
                  <label>Right</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={docSettings.margins.right}
                    onChange={(e) => {
                      const right = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setDocSettings((s) => ({ ...s, margins: { ...s.margins, right } }));
                      setIsDirty(true);
                      setDirty(PANEL, file.path, true);
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="rv-office-document-toolbar-divider" />
          <button
            className="rv-office-document-toolbar-btn"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
            title="Zoom out"
          >
            <span className="material-symbols-outlined">zoom_out</span>
          </button>
          <span className="rv-office-document-toolbar-zoom">{Math.round(zoom * 100)}%</span>
          <button
            className="rv-office-document-toolbar-btn"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}
            title="Zoom in"
          >
            <span className="material-symbols-outlined">zoom_in</span>
          </button>
        </div>

        {/* Workspace: editor + side panel */}
        <div className={`rv-office-document-workspace${sidePanel !== 'none' ? ' rv-office-workspace--drawer-open' : ''}`}>
          {/* Editor surface */}
          <div
            className="rv-office-document-editor"
            style={{
              '--editor-zoom': zoom,
              '--doc-font-family': getFontCss(docSettings.font.family),
              '--doc-font-size': `${docSettings.font.size}px`,
              '--doc-alignment': docSettings.alignment,
              '--doc-margin-top': `${docSettings.margins.top}px`,
              '--doc-margin-bottom': `${docSettings.margins.bottom}px`,
              '--doc-margin-left': `${docSettings.margins.left}px`,
              '--doc-margin-right': `${docSettings.margins.right}px`,
            } as React.CSSProperties}
          >
            <div ref={containerRef} />
          </div>
        </div>

      </div>

      {/* Side panel — absolutely positioned over topbar + body */}
      <div className="rv-office-document-sidepanel" data-open={sidePanel !== 'none'}>
        {sidePanel === 'versions' && (
          <div className="rv-office-versions-panel">
            <div className="rv-office-versions-empty">
              <span className="material-symbols-outlined">history</span>
              <p>No versions yet</p>
            </div>
          </div>
        )}
        {sidePanel === 'files' && (
          <div className="rv-office-document-ribbon-scroll">
            {recentDocs.length === 0 ? (
              <div className="rv-office-versions-empty">
                <span className="material-symbols-outlined">history</span>
                <p>No recent documents</p>
              </div>
            ) : (
              recentDocs.map((doc) => {
                const content = contents[`${doc.panel}:${doc.path}`] || '';
                return (
                  <OfficeDocumentTile
                    key={doc.path}
                    name={doc.name}
                    content={content}
                    extension={doc.name.split('.').pop()?.toLowerCase()}
                    panel={doc.panel}
                    folderPath={doc.folder}
                    size="small"
                    active={doc.path === file.path}
                    highlighted={doc.path === highlightedPath}
                    onClick={() => {
                      previewSelect(doc.path);
                      requestNavigation({ type: 'file', path: doc.path, folder: doc.folder });
                    }}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Dirty modal removed — navigation is non-blocking with background save */}
    </div>
  );
}
