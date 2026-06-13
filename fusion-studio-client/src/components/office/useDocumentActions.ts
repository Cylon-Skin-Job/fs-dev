/**
 * @module useDocumentActions
 * @role Export, print, and email action handlers for OfficeDocumentPage.
 *       Encapsulates the three Electron-gated operations so the main
 *       component only manages editor state and save logic.
 */
import { useState, useCallback } from 'react';
import { Crepe } from '@milkdown/crepe';
import type { FileWithContent, SaveReason } from '../../state/fileDataStore';
import { showToast } from '../../lib/toast';
import {
  serializeDocumentSettings,
  type DocumentSettings,
} from '../../lib/front-matter';

const PANEL = 'office-viewer';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

interface UseDocumentActionsOptions {
  file: FileWithContent;
  isDirty: boolean;
  docSettings: DocumentSettings;
  crepeRef: React.RefObject<Crepe | null>;
  getSerializedMarkdown: () => Promise<string>;
  saveFile: (panel: string, path: string, content: string, reason: SaveReason, milestone?: string) => void;
  setDirty: (panel: string, path: string, dirty: boolean) => void;
  setIsDirty: (dirty: boolean) => void;
}

export function useDocumentActions({
  file,
  isDirty,
  docSettings,
  crepeRef,
  getSerializedMarkdown,
  saveFile,
  setDirty,
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
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';

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
  }, [file.name, file.path, isDirty, saveFile, setDirty, setIsDirty, docSettings, getSerializedMarkdown, crepeRef]);

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
      if (isDirty) {
        saveFile(PANEL, file.path, fullContent, 'autosave');
        setIsDirty(false);
        setDirty(PANEL, file.path, false);
      }
      saveFile(PANEL, file.path, fullContent, 'milestone', 'print');
      const result = await window.electronAPI.printDocument({ content: markdown, filename: baseName });
      if (!result.success) {
        showToast(`Print failed: ${result.error}`);
      }
    } catch (error) {
      showToast(`Print failed: ${getErrorMessage(error)}`);
    }
  }, [file.name, file.path, isDirty, saveFile, setDirty, setIsDirty, docSettings, getSerializedMarkdown, crepeRef]);

  const handleSendEmail = useCallback(async (format: 'docx' | 'pdf' | 'markdown') => {
    if (!window.electronAPI?.sendDocumentEmail) {
      showToast('Email sending is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;

    setExportingFormat(format === 'markdown' ? null : format);
    try {
      const markdown = await getSerializedMarkdown();
      const fullContent = serializeDocumentSettings(markdown, docSettings);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';
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
  }, [file.name, file.path, isDirty, saveFile, setDirty, setIsDirty, docSettings, getSerializedMarkdown, crepeRef]);

  return { exportingFormat, setExportingFormat, handleExport, handlePrint, handleSendEmail };
}
