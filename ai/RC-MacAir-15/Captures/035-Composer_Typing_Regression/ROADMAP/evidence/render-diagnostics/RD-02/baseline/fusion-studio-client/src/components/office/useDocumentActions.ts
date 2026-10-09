/**
 * @module useDocumentActions
 * @role Export, print, and email action handlers for OfficeDocumentPage.
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
import { downloadDocumentArtifact } from '../../lib/downloadDocumentArtifact.mjs';
import {
  buildLegacyEmailDocumentPayload,
  buildOfficeEmailAttachmentPayload,
  buildOfficeExportDocumentPayload,
  buildOfficePrintDocumentPayload,
} from '../../lib/documentOutputPayloads';
import {
  serializeOfficeOutputSnapshot,
  type CapturedOfficeOutputState,
} from './officeTableOutputDescriptor';

const PANEL = 'office-viewer';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

interface UseDocumentActionsOptions {
  file: FileWithContent;
  crepeRef: React.RefObject<Crepe | null>;
  captureOfficeOutputState: () => CapturedOfficeOutputState;
  saveFile: SaveFileAction;
  setIsDirty: (dirty: boolean) => void;
}

export function useDocumentActions({
  file,
  crepeRef,
  captureOfficeOutputState,
  saveFile,
  setIsDirty,
}: UseDocumentActionsOptions) {
  const [exportingFormat, setExportingFormat] = useState<'docx' | 'pdf' | 'markdown' | null>(null);

  const handleExport = useCallback(async (format: 'docx' | 'pdf') => {
    if (!window.electronAPI?.exportDocument) {
      showToast('Export is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;

    setExportingFormat(format);
    try {
      const capturedDirtyRevision = documentDirtyRevision(PANEL, file.path);
      const snapshot = await serializeOfficeOutputSnapshot(captureOfficeOutputState);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';
      const payload = buildOfficeExportDocumentPayload({
        sourceType: 'document',
        sourceFormat: 'markdown',
        format,
        content: snapshot.bodyMarkdown,
        filename: baseName,
        presentationMode: 'office-tables',
        tablePresentation: snapshot.tablePresentation,
      });

      const milestone = format === 'pdf' ? 'export_pdf' : 'export_docx';
      await saveAcknowledgedMilestone({
        panel: PANEL, path: file.path, content: snapshot.fullMarkdown, milestone,
        capturedDirtyRevision, saveFile, setLocalDirty: setIsDirty,
      });

      const result = await window.electronAPI.exportDocument(payload);

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

      downloadDocumentArtifact({ bytes, filename: result.filename, mimeType });
    } catch (error) {
      showToast(`Export failed: ${getErrorMessage(error)}`);
    } finally {
      setExportingFormat(null);
    }
  }, [file.name, file.path, saveFile, setIsDirty, captureOfficeOutputState, crepeRef]);

  const handlePrint = useCallback(async () => {
    if (!window.electronAPI?.printDocument) {
      showToast('Print is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;
    setExportingFormat('pdf');
    try {
      const capturedDirtyRevision = documentDirtyRevision(PANEL, file.path);
      const snapshot = await serializeOfficeOutputSnapshot(captureOfficeOutputState);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';
      const payload = buildOfficePrintDocumentPayload({
        content: snapshot.bodyMarkdown,
        filename: baseName,
        presentationMode: 'office-tables',
        tablePresentation: snapshot.tablePresentation,
      });
      await saveAcknowledgedMilestone({
        panel: PANEL, path: file.path, content: snapshot.fullMarkdown, milestone: 'print',
        capturedDirtyRevision, saveFile, setLocalDirty: setIsDirty,
      });
      const result = await window.electronAPI.printDocument(payload);
      if (!result.success) {
        showToast(`Print failed: ${result.error}`);
      }
    } catch (error) {
      showToast(`Print failed: ${getErrorMessage(error)}`);
    } finally {
      setExportingFormat(null);
    }
  }, [file.name, file.path, saveFile, setIsDirty, captureOfficeOutputState, crepeRef]);

  const handleSendEmail = useCallback(async (format: 'docx' | 'pdf' | 'markdown') => {
    if (!window.electronAPI?.sendDocumentEmail) {
      showToast('Email sending is only available in the desktop app.');
      return;
    }
    if (!crepeRef.current) return;

    setExportingFormat(format);
    try {
      const capturedDirtyRevision = documentDirtyRevision(PANEL, file.path);
      const snapshot = await serializeOfficeOutputSnapshot(captureOfficeOutputState);
      const baseName = file.name.replace(/\.md$/i, '') || 'document';
      const payload = format === 'markdown'
        ? buildLegacyEmailDocumentPayload({
          format,
          content: snapshot.fullMarkdown,
          filename: baseName,
        })
        : buildOfficeEmailAttachmentPayload({
          format,
          content: snapshot.bodyMarkdown,
          filename: baseName,
          presentationMode: 'office-tables',
          tablePresentation: snapshot.tablePresentation,
        });
      const milestoneMap = { docx: 'send_docx', pdf: 'send_pdf', markdown: 'send_markdown' };
      await saveAcknowledgedMilestone({
        panel: PANEL, path: file.path, content: snapshot.fullMarkdown, milestone: milestoneMap[format],
        capturedDirtyRevision, saveFile, setLocalDirty: setIsDirty,
      });
      const result = await window.electronAPI.sendDocumentEmail(payload);
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
  }, [file.name, file.path, saveFile, setIsDirty, captureOfficeOutputState, crepeRef]);

  return { exportingFormat, setExportingFormat, handleExport, handlePrint, handleSendEmail };
}
