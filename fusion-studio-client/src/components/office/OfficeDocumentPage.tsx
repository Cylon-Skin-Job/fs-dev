/**
 * @module OfficeDocumentPage
 * @role Full WYSIWYG document editor for markdown files in office-viewer.
 *       Owns all editor state and refs; delegates Crepe lifecycle to
 *       useCrepeEditor, export/print/email actions to useDocumentActions,
 *       and renders chrome via OfficeDocumentTopbar + OfficeDocumentToolbar.
 *
 *       Auto-save (500ms debounce), manual save (Ctrl+S), dirty tracking.
 */

import { useEffect, useRef, useState, useCallback, useMemo, type CSSProperties, type SetStateAction } from 'react';
import { editorViewCtx, serializerCtx } from '@milkdown/kit/core';
import { useFileDataStore } from '../../state/fileDataStore';
import type { FileWithContent, SaveReason } from '../../state/fileDataStore';
import { usePanelStore } from '../../state/panelStore';
import { OfficeDocumentTile } from './OfficeDocumentTile';
import { showToast } from '../../lib/toast';
import { activityId, normalizeViewActivity } from '../../lib/viewActivity';
import { normalizeViewCollections } from '../../lib/viewCollections';
import { sendFusionMessage } from '../../lib/ws-client';
import { normalizeOfficePaperBrightness, officePaperMuteAlpha } from '../../lib/officePaperBrightness';
import './OfficeDocumentPage.css';
import {
  getDocumentTableLayouts,
  getDocumentTableColors,
  getRawDocumentTableStyles,
  parseDocumentSettings,
  serializeDocumentSettings,
  setDocumentTableLayouts,
  setDocumentTableColors,
  setDocumentTableStyles,
  type DocumentSettings,
  type DocumentFrontmatter,
  type DocumentTableLayout,
  type DocumentTableColors,
  getFontCss,
} from '../../lib/front-matter';
import { convertMarksToHtmlSpans } from '../../lib/milkdown-span-style';
import {
  editorTextToOfficeMarkdown,
  officeMarkdownToEditorText,
} from '../../lib/officePlainMarkdown';
import { useCrepeEditor } from './useCrepeEditor';
import { useDocumentActions } from './useDocumentActions';
import { OfficeDocumentTopbar } from './OfficeDocumentTopbar';
import { OfficeDocumentToolbar } from './OfficeDocumentToolbar';
import type { CapturedOfficeOutputState } from './officeTableOutputDescriptor';
import {
  documentDirtyRevision,
  isDocumentDirty,
  saveBeforeDocumentNavigation,
} from '../documentSaveAcknowledgement';

const PANEL = 'office-viewer';
const THUMBNAIL_MAX_WIDTH = 420;
const THUMBNAIL_MAX_HEIGHT = 560;

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
  const [marginsMenuOpen, setMarginsMenuOpen] = useState(false);
  const [brightnessMenuOpen, setBrightnessMenuOpen] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const marginsMenuRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number | null>(null);
  const checkpointDueRef = useRef(false);
  const bodyRef = useRef<string>('');
  const handleSaveRef = useRef<(opts?: { notify?: boolean; reason?: SaveReason; milestone?: string }) => Promise<void>>(async () => {});
  const thumbnailCaptureRef = useRef(false);

  const saveFile = useFileDataStore((s) => s.saveFile);
  const setDirty = useFileDataStore((s) => s.setDirty);
  const contents = useFileDataStore((s) => s.contents);
  const fileDataGeneration = useFileDataStore((s) => s.generation);

  const rawOfficeActivity = usePanelStore((s) => s.viewStates[PANEL]?.activity);
  const rawOfficeCollections = usePanelStore((s) => s.viewStates[PANEL]?.collections);
  const sidePanel = usePanelStore((s) => s.viewStates[PANEL]?.officeDocumentSidePanel ?? 'none');
  const rawOfficePaperBrightness = usePanelStore((s) => s.viewStates[PANEL]?.officePaperBrightness);
  const officePaperBrightness = normalizeOfficePaperBrightness(rawOfficePaperBrightness);
  const setViewState = usePanelStore((s) => s.setViewState);
  const persistViewPatch = usePanelStore((s) => s._persistViewPatch);
  const recentDocs = useMemo(
    () => normalizeViewActivity(rawOfficeActivity).recents,
    [rawOfficeActivity]
  );
  const starredIds = useMemo(
    () => new Set(normalizeViewCollections(rawOfficeCollections).starred.map((item) => item.id)),
    [rawOfficeCollections]
  );

  const parsed = useMemo(() => parseDocumentSettings(file.content), [file.content]);
  const editorBody = useMemo(() => officeMarkdownToEditorText(parsed.body), [parsed.body]);
  const [documentState, setDocumentState] = useState(() => ({
    content: file.content,
    settings: parsed.settings,
    frontmatter: parsed.frontmatter,
  }));
  const docSettingsRef = useRef<DocumentSettings>(parsed.settings);
  const docFrontmatterRef = useRef<DocumentFrontmatter>(parsed.frontmatter);

  let docSettings = documentState.settings;
  let docFrontmatter: DocumentFrontmatter = documentState.frontmatter;
  if (documentState.content !== file.content) {
    docSettings = parsed.settings;
    docFrontmatter = parsed.frontmatter;
    docSettingsRef.current = parsed.settings;
    docFrontmatterRef.current = parsed.frontmatter;
    setDocumentState({
      content: file.content,
      settings: parsed.settings,
      frontmatter: parsed.frontmatter,
    });
  }
  docSettingsRef.current = docSettings;
  docFrontmatterRef.current = docFrontmatter;

  const tableLayouts = useMemo(
    () => getDocumentTableLayouts(docFrontmatter),
    [docFrontmatter]
  );

  const tableColors = useMemo(
    () => getDocumentTableColors(docFrontmatter),
    [docFrontmatter]
  );

  const tableStyles = useMemo(
    () => getRawDocumentTableStyles(docFrontmatter),
    [docFrontmatter]
  );

  const setDocSettings = useCallback((settingsAction: SetStateAction<DocumentSettings>) => {
    setDocumentState((prev) => {
      const settings = typeof settingsAction === 'function'
        ? settingsAction(prev.settings)
        : settingsAction;
      docSettingsRef.current = settings;
      return { ...prev, settings };
    });
  }, []);

  const handleTableLayoutsChange = useCallback((layouts: DocumentTableLayout[]) => {
    const frontmatter = setDocumentTableLayouts(docFrontmatterRef.current, layouts);
    docFrontmatterRef.current = frontmatter;
    setDocumentState((prev) => ({ ...prev, frontmatter }));
  }, []);

  const handleTableColorsChange = useCallback((colors: DocumentTableColors[]) => {
    const frontmatter = setDocumentTableColors(docFrontmatterRef.current, colors);
    docFrontmatterRef.current = frontmatter;
    setDocumentState((prev) => ({ ...prev, frontmatter }));
  }, []);

  const handleTableStylesChange = useCallback((styles: unknown) => {
    const frontmatter = setDocumentTableStyles(docFrontmatterRef.current, styles);
    docFrontmatterRef.current = frontmatter;
    setDocumentState((prev) => ({ ...prev, frontmatter }));
  }, []);

  const handlePageAlignmentPublication = useCallback((alignment: DocumentSettings['alignment']) => {
    setDocumentState((prev) => {
      const settings = { ...prev.settings, alignment };
      docSettingsRef.current = settings;
      return { ...prev, settings };
    });
  }, []);

  useEffect(() => {
    bodyRef.current = editorBody;
  }, [editorBody]);

  const {
    crepeRef,
    tableGeometryRef,
    tableColorsRef,
    tableDisplayRef,
  } = useCrepeEditor({
    containerRef,
    filePath: file.path,
    fileContent: file.content,
    parsedBody: editorBody,
    tableLayouts,
    onTableLayoutsChange: handleTableLayoutsChange,
    tableColors,
    onTableColorsChange: handleTableColorsChange,
    tableStyles,
    onTableStylesChange: handleTableStylesChange,
    pageAlignment: docSettings.alignment,
    onPageAlignmentChange: handlePageAlignmentPublication,
    setIsDirty,
    setDirty,
    handleSaveRef,
    bodyRef,
    autoSaveTimerRef,
    sessionStartRef,
    checkpointDueRef,
  });

  useEffect(() => {
    const fileData = useFileDataStore.getState();
    for (const doc of recentDocs) {
      const key = `${doc.panel}:${doc.path}`;
      if (!(key in fileData.contents)) {
        fileData.requestContent(doc.panel, doc.path);
      }
    }
  }, [fileDataGeneration, recentDocs]);

  const getSerializedMarkdown = useCallback((): string => {
    if (!crepeRef.current) return '';
    return crepeRef.current.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx);
      const doc = view.state.doc;
      const transformed = convertMarksToHtmlSpans(doc);
      const serializer = ctx.get(serializerCtx);
      return editorTextToOfficeMarkdown(serializer(transformed));
    });
  }, [crepeRef]);

  const captureOfficeOutputState = useCallback((): CapturedOfficeOutputState => {
    if (!crepeRef.current) throw new Error('Office editor is not ready');
    const bodyMarkdown = getSerializedMarkdown();
    let frontmatter = docFrontmatterRef.current;
    const currentLayouts = tableGeometryRef.current?.readLayouts();
    if (currentLayouts) frontmatter = setDocumentTableLayouts(frontmatter, currentLayouts);
    const currentColors = tableColorsRef.current?.readColors();
    if (currentColors) frontmatter = setDocumentTableColors(frontmatter, currentColors);
    if (tableDisplayRef.current) {
      frontmatter = setDocumentTableStyles(frontmatter, tableDisplayRef.current.readStyles());
    }
    return {
      bodyMarkdown,
      settings: docSettingsRef.current,
      frontmatter,
    };
  }, [crepeRef, getSerializedMarkdown, tableColorsRef, tableDisplayRef, tableGeometryRef]);

  const handleSave = useCallback(async (options?: { notify?: boolean; reason?: SaveReason; milestone?: string }) => {
    if (!crepeRef.current) return;
    try {
      const capturedDirtyRevision = documentDirtyRevision(PANEL, file.path);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      const markdown = await getSerializedMarkdown();
      const currentLayouts = tableGeometryRef.current?.readLayouts();
      let frontmatter = docFrontmatterRef.current;
      if (currentLayouts) {
        frontmatter = setDocumentTableLayouts(frontmatter, currentLayouts);
        docFrontmatterRef.current = frontmatter;
        setDocumentState((prev) => ({ ...prev, frontmatter }));
      }
      const currentColors = tableColorsRef.current?.readColors();
      if (currentColors) {
        frontmatter = setDocumentTableColors(frontmatter, currentColors);
        docFrontmatterRef.current = frontmatter;
        setDocumentState((prev) => ({ ...prev, frontmatter }));
      }
      if (tableDisplayRef.current) {
        const currentStyles = tableDisplayRef.current.readStyles();
        frontmatter = setDocumentTableStyles(
          frontmatter,
          currentStyles,
        );
        docFrontmatterRef.current = frontmatter;
        setDocumentState((prev) => ({ ...prev, frontmatter }));
      }
      const fullContent = serializeDocumentSettings(markdown, docSettingsRef.current, frontmatter);
      const reason = checkpointDueRef.current ? 'checkpoint' : (options?.reason ?? 'autosave');
      await saveFile(
        PANEL, file.path, fullContent, reason, options?.milestone, capturedDirtyRevision,
      );
      if (!isDocumentDirty(PANEL, file.path)) {
        bodyRef.current = markdown;
        setIsDirty(false);
        sessionStartRef.current = null;
        checkpointDueRef.current = false;
      }
      if (options?.notify) showToast('Saving document...');
    } catch (error) {
      showToast(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }, [
    file.path,
    saveFile,
    getSerializedMarkdown,
    crepeRef,
    tableGeometryRef,
    tableColorsRef,
    tableDisplayRef,
  ]);

  useEffect(() => { handleSaveRef.current = handleSave; }, [handleSave]);

  const { exportingFormat, handleExport, handlePrint, handleSendEmail } = useDocumentActions({
    file,
    crepeRef,
    captureOfficeOutputState,
    saveFile,
    setIsDirty,
  });

  const captureDocumentThumbnail = useCallback(async () => {
    if (thumbnailCaptureRef.current || !window.electronAPI?.captureRect) return;
    const editor = document.querySelector('.rv-office-document-editor') as HTMLElement | null;
    const documentPage = editor?.querySelector('.milkdown') as HTMLElement | null;
    if (!editor || !documentPage) return;

    thumbnailCaptureRef.current = true;
    documentPage.classList.add('rv-office-paper-filter-capture-clean');
    try {
      editor.scrollTop = 0;
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const rect = documentPage.getBoundingClientRect();
      const captureHeight = Math.min(rect.height, window.innerHeight - rect.top - 8);
      if (rect.width < 20 || captureHeight < 20) return;

      const base64 = await window.electronAPI.captureRect({
        x: Math.max(0, Math.round(rect.x)),
        y: Math.max(0, Math.round(rect.y)),
        width: Math.round(rect.width),
        height: Math.round(captureHeight),
        maxWidth: THUMBNAIL_MAX_WIDTH,
        maxHeight: THUMBNAIL_MAX_HEIGHT,
      });
      if (!base64) return;
      sendFusionMessage({
        type: 'office:thumbnail_save',
        documentPath: file.path,
        dataUrl: `data:image/png;base64,${base64}`,
      });
    } catch (error) {
      console.warn('[OfficeDocumentPage] thumbnail capture failed:', error);
    } finally {
      documentPage.classList.remove('rv-office-paper-filter-capture-clean');
      thumbnailCaptureRef.current = false;
    }
  }, [file.path]);

  const runNavigation = useCallback((navigation: PendingNavigation) => {
    if (navigation.type === 'back') { onBack(); return; }
    onOpenFile(navigation.path, navigation.folder);
  }, [onBack, onOpenFile]);

  const handleToggleRecentPanel = useCallback(() => {
    const nextSidePanel = sidePanel === 'files' ? 'none' : 'files';
    setViewState(PANEL, { officeDocumentSidePanel: nextSidePanel });
    persistViewPatch(PANEL, { officeDocumentSidePanel: nextSidePanel });
  }, [persistViewPatch, setViewState, sidePanel]);

  const handlePaperBrightnessChange = useCallback((nextValue: number) => {
    const nextBrightness = normalizeOfficePaperBrightness(nextValue);
    setViewState(PANEL, { officePaperBrightness: nextBrightness });
    persistViewPatch(PANEL, { officePaperBrightness: nextBrightness });
  }, [persistViewPatch, setViewState]);

  const officePaperStyle = useMemo(() => ({
    '--rv-office-paper-mute-alpha': officePaperMuteAlpha(officePaperBrightness),
  }) as CSSProperties, [officePaperBrightness]);

  const requestNavigation = useCallback(async (navigation: PendingNavigation) => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (crepeRef.current) {
      try {
        await saveBeforeDocumentNavigation({
          panel: PANEL,
          path: file.path,
          saveCurrent: () => handleSaveRef.current({ reason: 'autosave' }),
        });
      } catch {
        return;
      }
    }
    await captureDocumentThumbnail();
    runNavigation(navigation);
  }, [captureDocumentThumbnail, file.path, runNavigation, crepeRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void handleSave({ notify: true, reason: 'manual' }).catch(() => {});
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
    <div className="rv-office-document-page" style={officePaperStyle}>
      <OfficeDocumentTopbar
        file={file}
        folderName={folderName}
        isDirty={isDirty}
        sidePanel={sidePanel}
        onToggleRecentPanel={handleToggleRecentPanel}
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
          onAlignmentChange={(alignment) => {
            tableDisplayRef.current?.applyPageAlignment(alignment);
          }}
          zoom={zoom}
          setZoom={setZoom}
          crepeRef={crepeRef}
          setIsDirty={setIsDirty}
          setDirty={setDirty}
          marginsMenuRef={marginsMenuRef}
          marginsMenuOpen={marginsMenuOpen}
          setMarginsMenuOpen={setMarginsMenuOpen}
          brightnessMenuOpen={brightnessMenuOpen}
          setBrightnessMenuOpen={setBrightnessMenuOpen}
          paperBrightness={officePaperBrightness}
          onPaperBrightnessChange={handlePaperBrightnessChange}
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
        {sidePanel === 'files' && (
          <div className="rv-office-document-ribbon-scroll">
            {recentDocs.length === 0 ? (
              <div className="rv-office-document-sidepanel-empty">
                <span className="material-symbols-outlined">browse_gallery</span>
                <p>No recent documents</p>
              </div>
            ) : (
              recentDocs.map((doc) => {
                const content = contents[`${doc.panel}:${doc.path}`] || '';
                return (
                  <OfficeDocumentTile
                    key={doc.path}
                    name={doc.title}
                    content={content}
                    extension={doc.extension ?? doc.title.split('.').pop()?.toLowerCase()}
                    panel={doc.panel}
                    folderPath={doc.folder ?? ''}
                    starred={starredIds.has(activityId(doc.panel, doc.path))}
                    size="small"
                    active={doc.path === file.path}
                    onClick={() => {
                      requestNavigation({ type: 'file', path: doc.path, folder: doc.folder ?? '' });
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
