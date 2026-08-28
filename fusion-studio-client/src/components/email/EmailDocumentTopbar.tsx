/**
 * @module EmailDocumentTopbar
 * @role Pure renderer for the document editor's top navigation strip.
 *       Includes the back button, filename/dirty indicator, export dropdown
 *       menu, side-panel toggles, and page-level path actions.
 */
import type { FileWithContent } from '../../state/fileDataStore';
import { FloatingPathActions } from '../FloatingPathActions';

const PANEL = 'email-viewer';

interface EmailDocumentTopbarProps {
  file: FileWithContent;
  folderName?: string;
  isDirty: boolean;
  sidePanel: 'none' | 'files';
  onToggleRecentPanel: () => void;
  exportMenuRef: React.RefObject<HTMLDivElement | null>;
  exportMenuOpen: boolean;
  setExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exportingFormat: 'docx' | 'pdf' | null;
  onBack: () => void;
  onExport: (format: 'docx' | 'pdf') => void;
  onPrint: () => void;
  onSendEmail: (format: 'docx' | 'pdf' | 'markdown') => void;
}

export function EmailDocumentTopbar({
  file,
  folderName,
  isDirty,
  sidePanel,
  onToggleRecentPanel,
  exportMenuRef,
  exportMenuOpen,
  setExportMenuOpen,
  exportingFormat,
  onBack,
  onExport,
  onPrint,
  onSendEmail,
}: EmailDocumentTopbarProps) {
  return (
    <div className="rv-email-document-topbar">
      <button
        className="rv-email-document-back"
        onClick={onBack}
        title="Back"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>

      <span className="rv-email-document-filename">
        {folderName ? `${folderName} / ${file.name}` : file.name}
        {isDirty ? <span className="rv-email-document-dirty">Unsaved</span> : null}
      </span>

      <div className="rv-email-document-actions">
        <div className="rv-email-export-menu" ref={exportMenuRef}>
          <button
            className="rv-email-document-action"
            onClick={() => setExportMenuOpen((v) => !v)}
            disabled={exportingFormat !== null}
            title="Export"
          >
            <span className={`material-symbols-outlined${exportingFormat !== null ? ' rv-email-spin' : ''}`}>
              {exportingFormat !== null ? 'progress_activity' : 'bubble'}
            </span>
          </button>
          {exportMenuOpen && (
            <div className="rv-email-export-dropdown">
              <div className="rv-email-export-row">
                <button className="rv-email-export-option" disabled={exportingFormat !== null}>
                  <span className="material-symbols-outlined">description</span>
                  Export DOCX
                  <span className="material-symbols-outlined rv-email-export-chevron">chevron_right</span>
                </button>
                <div className="rv-email-export-submenu">
                  <button
                    className="rv-email-export-submenu-option"
                    onClick={() => { setExportMenuOpen(false); onSendEmail('docx'); }}
                    disabled={exportingFormat !== null}
                  >
                    <span className="material-symbols-outlined">attach_email</span>
                    Email
                  </button>
                  <button
                    className="rv-email-export-submenu-option"
                    onClick={() => { setExportMenuOpen(false); onExport('docx'); }}
                    disabled={exportingFormat !== null}
                  >
                    <span className="material-symbols-outlined">drive_file_move</span>
                    Folder
                  </button>
                </div>
              </div>
              <div className="rv-email-export-row">
                <button className="rv-email-export-option" disabled={exportingFormat !== null}>
                  <span className="material-symbols-outlined">picture_as_pdf</span>
                  Export PDF
                  <span className="material-symbols-outlined rv-email-export-chevron">chevron_right</span>
                </button>
                <div className="rv-email-export-submenu">
                  <button
                    className="rv-email-export-submenu-option"
                    onClick={() => { setExportMenuOpen(false); onSendEmail('pdf'); }}
                    disabled={exportingFormat !== null}
                  >
                    <span className="material-symbols-outlined">attach_email</span>
                    Email
                  </button>
                  <button
                    className="rv-email-export-submenu-option"
                    onClick={() => { setExportMenuOpen(false); onExport('pdf'); }}
                    disabled={exportingFormat !== null}
                  >
                    <span className="material-symbols-outlined">drive_file_move</span>
                    Folder
                  </button>
                </div>
              </div>
              <div className="rv-email-export-divider" />
              <button
                className="rv-email-export-option"
                onClick={() => { setExportMenuOpen(false); onPrint(); }}
              >
                <span className="material-symbols-outlined">print</span>
                Preview PDF
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="rv-email-document-spacer" />

      <div className={`rv-email-document-sidepanel-header${sidePanel === 'files' ? ' rv-email-document-sidepanel-header--open' : ''}`}>
        {sidePanel === 'files' ? (
          <span className="rv-email-document-sidepanel-heading">Recent</span>
        ) : null}
        <button
          className={`rv-email-document-action${sidePanel === 'files' ? ' rv-email-document-action--active' : ''}${sidePanel !== 'none' ? ' rv-email-document-action--floating' : ''}`}
          onClick={onToggleRecentPanel}
          title="Recent documents"
        >
          <span className="material-symbols-outlined">browse_gallery</span>
        </button>
      </div>

      <FloatingPathActions
        panel={PANEL}
        relativePath={file.path}
        copyTitle="Copy path"
        sendTitle="Send path to chat"
        ariaLabel="Email document actions"
      />
    </div>
  );
}
