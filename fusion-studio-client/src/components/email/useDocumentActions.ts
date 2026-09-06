/**
 * @module useDocumentActions
 * @role Export, print, and email action handlers for EmailDocumentPage.
 *       Encapsulates the three Electron-gated operations so the main
 *       component only manages editor state and save logic.
 */
import { useState, useCallback } from 'react';
import { Crepe } from '@milkdown/crepe';
import type { FileWithContent } from '../../state/fileDataStore';
import { showToast } from '../../lib/toast';
import {
  documentDirtyRevision,
  saveAcknowledgedMilestone,
  type SaveFileAction,
} from '../documentSaveAcknowledgement';
import {
  buildLegacyEmailDocumentPayload,
  buildLegacyExportDocumentPayload,
  buildLegacyPrintDocumentPayload,
} from '../../lib/documentOutputPayloads';
import {
  serializeDocumentSettings,
  type DocumentSettings,
  type DocumentFrontmatter,
} from '../../lib/front-matter';

const PANEL = 'email-viewer';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

interface UseDocumentActionsOptions {
  file: FileWithContent;
  docSettings: DocumentSettings;
  docFrontmatter: DocumentFrontmatter;
  crepeRef: React.RefObject<Crepe | null>;
  getSerializedMarkdown: () => Promise<string>;
  saveFile: SaveFileAction;
  setIsDirty: (dirty: boolean) => void;
}

export function useDocumentActions({
  file,
  docSettings,
  docFrontmatter,
  crepeRef,
  getSerializedMarkdown,
  saveFile,
  setIsDirty,
}: UseDocumentActionsOptions) {
  const [exportingFormat, setExportingFormat] = useState<'docx' | 'pdf' | null>(null);

  const handleExport = useCallback(async (format: 'docx' | 'pdf') => {
    if (!window.electronAPI?.exportDocument) {
      showToast('Export is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;

    setExportingFormat(format);
    try {
      const capturedDirtyRevision = documentDirtyRevision(PANEL, file.path);
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings, docFrontmatter);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';

      const milestone = format === 'pdf' ? 'export_pdf' : 'export_docx';
      await saveAcknowledgedMilestone({
        panel: PANEL, path: file.path, content: fullContent, milestone,
        capturedDirtyRevision, saveFile, setLocalDirty: setIsDirty,
      });

      const result = await window.electronAPI.exportDocument(buildLegacyExportDocumentPayload({
        sourceType: 'document',
        sourceFormat: 'markdown',
        format,
        content: markdown,
        filename: baseName,
      }));

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
  }, [file.name, file.path, saveFile, setIsDirty, docSettings, docFrontmatter, getSerializedMarkdown, crepeRef]);

  const handlePrint = useCallback(async () => {
    if (!window.electronAPI?.printDocument) {
      showToast('Print is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;
    try {
      const capturedDirtyRevision = documentDirtyRevision(PANEL, file.path);
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings, docFrontmatter);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';
      await saveAcknowledgedMilestone({
        panel: PANEL, path: file.path, content: fullContent, milestone: 'print',
        capturedDirtyRevision, saveFile, setLocalDirty: setIsDirty,
      });
      const result = await window.electronAPI.printDocument(buildLegacyPrintDocumentPayload({
        content: markdown,
        filename: baseName,
      }));
      if (!result.success) {
        showToast(`Print failed: ${result.error}`);
      }
    } catch (error) {
      showToast(`Print failed: ${getErrorMessage(error)}`);
    }
  }, [file.name, file.path, saveFile, setIsDirty, docSettings, docFrontmatter, getSerializedMarkdown, crepeRef]);

  const handleSendEmail = useCallback(async (format: 'docx' | 'pdf' | 'markdown') => {
    if (!window.electronAPI?.sendDocumentEmail) {
      showToast('Email sending is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;

    setExportingFormat(format === 'markdown' ? null : format);
    try {
      const capturedDirtyRevision = documentDirtyRevision(PANEL, file.path);
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings, docFrontmatter);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';
      const milestoneMap = { docx: 'send_docx', pdf: 'send_pdf', markdown: 'send_markdown' };
      await saveAcknowledgedMilestone({
        panel: PANEL, path: file.path, content: fullContent, milestone: milestoneMap[format],
        capturedDirtyRevision, saveFile, setLocalDirty: setIsDirty,
      });
      const result = await window.electronAPI.sendDocumentEmail(buildLegacyEmailDocumentPayload({
        format,
        content: markdown,
        filename: baseName,
      }));
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
  }, [file.name, file.path, saveFile, setIsDirty, docSettings, docFrontmatter, getSerializedMarkdown, crepeRef]);

  return { exportingFormat, setExportingFormat, handleExport, handlePrint, handleSendEmail };
}
