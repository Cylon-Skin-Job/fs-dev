/**
 * @module OfficeDocumentPage
 * @role Full WYSIWYG document editor for markdown files in office-viewer.
 *       Owns all editor state and refs; delegates Crepe lifecycle to
 *       useCrepeEditor, export/print/email actions to useDocumentActions,
 *       and renders chrome via OfficeDocumentTopbar + OfficeDocumentToolbar.
 *
 *       Auto-save (500ms debounce), manual save (Ctrl+S), dirty tracking.
 */

import { useEffect, useRef, useState, useCallback, useMemo, type SetStateAction } from 'react';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { useFileDataStore } from '../../state/fileDataStore';
import type { FileWithContent, SaveReason } from '../../state/fileDataStore';
import { useRecentDocsStore } from '../../state/recentDocsStore';
import { usePanelStore } from '../../state/panelStore';
import { OfficeDocumentTile } from './OfficeDocumentTile';
import { showToast } from '../../lib/toast';
import './OfficeDocumentPage.css';
import {
  parseDocumentSettings,
  serializeDocumentSettings,
  type DocumentSettings,
  getFontCss,
} from '../../lib/front-matter';
import { convertMarksToHtmlSpans } from '../../lib/milkdown-span-style';
import { useCrepeEditor } from './useCrepeEditor';
import { useDocumentActions } from './useDocumentActions';
import { OfficeDocumentTopbar } from './OfficeDocumentTopbar';
import { OfficeDocumentToolbar } from './OfficeDocumentToolbar';

const PANEL = 'office-viewer';

type PendingNavigation =
  | { type: 'back' }
  | { type: 'file'; path: string; folder: string };

interface OfficeDocumentPageProps {
  file: FileWithContent;
  folder: string;
  folderName?: string;
  onBack: () => void;
  onOpenFile: (path: string, folder: string) => void;
}

export function OfficeDocumentPage({
  file,
  folderName,
  onBack,
  onOpenFile,
}: OfficeDocumentPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'versions' | 'files'>('none');
  const [marginsMenuOpen, setMarginsMenuOpen] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const marginsMenuRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number | null>(null);
  const checkpointDueRef = useRef(false);
  const bodyRef = useRef<string>('');
  const handleSaveRef = useRef<(opts?: { notify?: boolean; reason?: SaveReason; milestone?: string }) => Promise<void>>(async () => {});

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

  const parsed = useMemo(() => parseDocumentSettings(file.content), [file.content]);
  const [documentState, setDocumentState] = useState(() => ({
    content: file.content,
    settings: parsed.settings,
  }));

  let docSettings = documentState.settings;
  if (documentState.content !== file.content) {
    docSettings = parsed.settings;
    setDocumentState({
      content: file.content,
      settings: parsed.settings,
    });
  }

  const setDocSettings = useCallback((settingsAction: SetStateAction<DocumentSettings>) => {
    setDocumentState((prev) => {
      const settings = typeof settingsAction === 'function'
        ? settingsAction(prev.settings)
        : settingsAction;
      return { ...prev, settings };
    });
  }, []);

  useEffect(() => {
    bodyRef.current = parsed.body;
  }, [parsed.body]);

  const { crepeRef } = useCrepeEditor({
    containerRef,
    filePath: file.path,
    fileContent: file.content,
    parsedBody: parsed.body,
    setIsDirty,
    setDirty,
    handleSaveRef,
    bodyRef,
    autoSaveTimerRef,
    sessionStartRef,
    checkpointDueRef,
  });

  useEffect(() => {
    if (workspaceId) loadRecentDocs(workspaceId);
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

  const getSerializedMarkdown = useCallback(async (): Promise<string> => {
    if (!crepeRef.current) return '';
    return crepeRef.current.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const doc = view.state.doc;
      const transformed = convertMarksToHtmlSpans(doc);
      const serializer = ctx.get(serializerCtx);
      return serializer(transformed);
    });
  }, [crepeRef]);

  const handleSave = useCallback(async (options?: { notify?: boolean; reason?: SaveReason; milestone?: string }) => {
    if (!crepeRef.current) return;
    if (isSaving) {
      if (options?.notify) showToast('Save already in progress...');
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
      if (options?.notify) showToast('Saving document...');
    } catch (error) {
      showToast(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [file.path, isSaving, saveFile, setDirty, docSettings, getSerializedMarkdown, crepeRef]);

  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  const { exportingFormat, handleExport, handlePrint, handleSendEmail } = useDocumentActions({
    file,
    isDirty,
    docSettings,
    crepeRef,
    getSerializedMarkdown,
    saveFile,
    setDirty,
    setIsDirty,
  });

  const runNavigation = useCallback((navigation: PendingNavigation) => {
    if (navigation.type === 'back') { onBack(); return; }
    onOpenFile(navigation.path, navigation.folder);
  }, [onBack, onOpenFile]);

  const requestNavigation = useCallback((navigation: PendingNavigation) => {
    cancelPreviewSelect();
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (isDirty && !isSaving && crepeRef.current) {
      handleSaveRef.current({ reason: 'autosave' }).catch(() => {});
    }
    runNavigation(navigation);
  }, [isDirty, isSaving, runNavigation, cancelPreviewSelect, crepeRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave({ notify: true, reason: 'manual' });
        return;
      }
      if (e.key === 'Escape') requestNavigation({ type: 'back' });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, requestNavigation]);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

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
      <OfficeDocumentTopbar
        file={file}
        folderName={folderName}
        isDirty={isDirty}
        sidePanel={sidePanel}
        setSidePanel={setSidePanel}
        exportMenuRef={exportMenuRef}
        exportMenuOpen={exportMenuOpen}
        setExportMenuOpen={setExportMenuOpen}
        exportingFormat={exportingFormat}
        onBack={() => requestNavigation({ type: 'back' })}
        onExport={handleExport}
        onPrint={handlePrint}
        onSendEmail={handleSendEmail}
      />

      <div className="rv-office-document-body">
        <OfficeDocumentToolbar
          file={file}
          docSettings={docSettings}
          setDocSettings={setDocSettings}
          zoom={zoom}
          setZoom={setZoom}
          crepeRef={crepeRef}
          setIsDirty={setIsDirty}
          setDirty={setDirty}
          marginsMenuRef={marginsMenuRef}
          marginsMenuOpen={marginsMenuOpen}
          setMarginsMenuOpen={setMarginsMenuOpen}
        />

        <div className={`rv-office-document-workspace${sidePanel !== 'none' ? ' rv-office-workspace--drawer-open' : ''}`}>
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
    </div>
  );
}
