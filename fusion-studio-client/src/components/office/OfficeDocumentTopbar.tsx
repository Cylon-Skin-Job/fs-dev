/**
 * @module OfficeDocumentTopbar
 * @role Pure renderer for the document editor's top navigation strip.
 *       Includes the back button, filename/dirty indicator, copy/chat path
 *       actions, the export dropdown menu, and the side-panel toggles.
 */
import type { FileWithContent } from '../../state/fileDataStore';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

const PANEL = 'office-viewer';

interface OfficeDocumentTopbarProps {
  file: FileWithContent;
  folderName?: string;
  isDirty: boolean;
  sidePanel: 'none' | 'versions' | 'files';
  setSidePanel: React.Dispatch<React.SetStateAction<'none' | 'versions' | 'files'>>;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  exportMenuOpen: boolean;
  setExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exportingFormat: 'docx' | 'pdf' | null;
  onBack: () => void;
  onExport: (format: 'docx' | 'pdf') => void;
  onPrint: () => void;
  onSendEmail: (format: 'docx' | 'pdf' | 'markdown') => void;
}

export function OfficeDocumentTopbar({
  file,
  folderName,
  isDirty,
  sidePanel,
  setSidePanel,
  exportMenuRef,
  exportMenuOpen,
  setExportMenuOpen,
  exportingFormat,
  onBack,
  onExport,
  onPrint,
  onSendEmail,
}: OfficeDocumentTopbarProps) {
  return (
    <div className="rv-office-document-topbar">
      <button
        className="rv-office-document-back"
        onClick={onBack}
        title="Back"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <span className="rv-office-document-filename">
        {folderName ? `${folderName} / ${file.name}` : file.name}
        {isDirty ? <span className="rv-office-document-dirty">Unsaved</span> : null}
      </span>

      <div className="rv-office-document-actions">
        <CopyPathButton panel={PANEL} relativePath={file.path} className="rv-office-document-action" title="Copy path" />
        <SendToChatButton panel={PANEL} relativePath={file.path} className="rv-office-document-action" title="Send path to chat" />

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
                    onClick={() => { setExportMenuOpen(false); onSendEmail('docx'); }}
                    disabled={exportingFormat !== null}
                  >
                    <span className="material-symbols-outlined">attach_email</span>
                    Email
                  </button>
                  <button
                    className="rv-office-export-submenu-option"
                    onClick={() => { setExportMenuOpen(false); onExport('docx'); }}
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
                    onClick={() => { setExportMenuOpen(false); onSendEmail('pdf'); }}
                    disabled={exportingFormat !== null}
                  >
                    <span className="material-symbols-outlined">attach_email</span>
                    Email
                  </button>
                  <button
                    className="rv-office-export-submenu-option"
                    onClick={() => { setExportMenuOpen(false); onExport('pdf'); }}
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
                onClick={() => { setExportMenuOpen(false); onPrint(); }}
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
  );
}
