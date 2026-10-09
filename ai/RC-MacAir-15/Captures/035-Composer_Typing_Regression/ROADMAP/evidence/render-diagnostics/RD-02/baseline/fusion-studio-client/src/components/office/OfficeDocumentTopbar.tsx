/**
 * @module OfficeDocumentTopbar
 * @role Pure renderer for the document editor's top navigation strip.
 *       Includes the back button, filename/dirty indicator, export trigger,
 *       side-panel toggles, and the page-level floating path actions.
 */
import type { FileWithContent } from '../../state/fileDataStore';
import { FloatingPathActions } from '../FloatingPathActions';
import { OfficeDocumentExportMenuButton } from './OfficeDocumentExportMenuButton';

const PANEL = 'office-viewer';

interface OfficeDocumentTopbarProps {
  file: FileWithContent;
  folderName?: string;
  isDirty: boolean;
  sidePanel: 'none' | 'files';
  onToggleRecentPanel: () => void;
  exportingFormat: 'docx' | 'pdf' | 'markdown' | null;
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
  onToggleRecentPanel,
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
        <OfficeDocumentExportMenuButton
          exportingFormat={exportingFormat}
          onExport={onExport}
          onPrint={onPrint}
          onSendEmail={onSendEmail}
        />
      </div>

      <div className="rv-office-document-spacer" />

      <div className={`rv-office-document-sidepanel-header${sidePanel === 'files' ? ' rv-office-document-sidepanel-header--open' : ''}`}>
        {sidePanel === 'files' ? (
          <span className="rv-office-document-sidepanel-heading">Recent</span>
        ) : null}
        <button
          className={`rv-office-document-action${sidePanel === 'files' ? ' rv-office-document-action--active' : ''}${sidePanel !== 'none' ? ' rv-office-document-action--floating' : ''}`}
          onClick={onToggleRecentPanel}
          title="Recent documents"
        >
          <span className="material-symbols-outlined">browse_gallery</span>
        </button>
      </div>
      <FloatingPathActions panel={PANEL} relativePath={file.path} ariaLabel="Office document actions" />
    </div>
  );
}
