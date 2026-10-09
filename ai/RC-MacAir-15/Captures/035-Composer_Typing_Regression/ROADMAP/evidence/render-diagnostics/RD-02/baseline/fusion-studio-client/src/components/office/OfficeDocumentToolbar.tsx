/**
 * @module OfficeDocumentToolbar
 * @role Pure renderer for the document editor's formatting toolbar.
 *       Handles undo/redo, font family/size, text alignment, page margins,
 *       and zoom controls. All state is owned by OfficeDocumentPage.
 */
import { Crepe } from '@milkdown/crepe';
import { editorViewCtx } from '@milkdown/kit/core';
import { undo, redo } from '@milkdown/prose/history';
import type { FileWithContent } from '../../state/fileDataStore';
import type { DocumentSettings } from '../../lib/front-matter';
import { PaperBrightnessControl } from '../PaperBrightnessControl';

const PANEL = 'office-viewer';

interface OfficeDocumentToolbarProps {
  file: FileWithContent;
  docSettings: DocumentSettings;
  setDocSettings: React.Dispatch<React.SetStateAction<DocumentSettings>>;
  onAlignmentChange: (alignment: DocumentSettings['alignment']) => void;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  crepeRef: React.RefObject<Crepe | null>;
  setIsDirty: (dirty: boolean) => void;
  setDirty: (panel: string, path: string, dirty: boolean) => void;
  marginsMenuRef: React.RefObject<HTMLDivElement | null>;
  marginsMenuOpen: boolean;
  setMarginsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  brightnessMenuOpen: boolean;
  setBrightnessMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  paperBrightness: number;
  onPaperBrightnessChange: (value: number) => void;
}

export function OfficeDocumentToolbar({
  file,
  docSettings,
  setDocSettings,
  onAlignmentChange,
  zoom,
  setZoom,
  crepeRef,
  setIsDirty,
  setDirty,
  marginsMenuRef,
  marginsMenuOpen,
  setMarginsMenuOpen,
  brightnessMenuOpen,
  setBrightnessMenuOpen,
  paperBrightness,
  onPaperBrightnessChange,
}: OfficeDocumentToolbarProps) {
  const markDirty = () => {
    setIsDirty(true);
    setDirty(PANEL, file.path, true);
  };

  return (
    <div className="rv-office-document-toolbar">
      <button
        type="button"
        className="rv-office-document-toolbar-btn"
        title="Version history"
        aria-label="Version history"
      >
        <span className="material-symbols-outlined">history</span>
      </button>
      <button
        type="button"
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
        type="button"
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
          setDocSettings((s) => ({ ...s, font: { ...s.font, family: e.target.value } }));
          markDirty();
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
        onClick={() => { setDocSettings((s) => ({ ...s, font: { ...s.font, size: Math.max(8, s.font.size - 1) } })); markDirty(); }}
        title="Decrease font size"
      >
        <span className="material-symbols-outlined">remove</span>
      </button>
      <span className="rv-office-document-toolbar-fontsize">{docSettings.font.size}</span>
      <button
        className="rv-office-document-toolbar-btn"
        onClick={() => { setDocSettings((s) => ({ ...s, font: { ...s.font, size: Math.min(72, s.font.size + 1) } })); markDirty(); }}
        title="Increase font size"
      >
        <span className="material-symbols-outlined">add</span>
      </button>

      <div className="rv-office-document-toolbar-divider" />

      {(['left', 'center', 'right', 'justify'] as const).map((align) => (
        <button
          key={align}
          className={`rv-office-document-toolbar-btn${docSettings.alignment === align ? ' rv-office-toolbar-btn--active' : ''}`}
          onClick={() => onAlignmentChange(align)}
          title={`Align ${align}`}
        >
          <span className="material-symbols-outlined">
            {align === 'left' ? 'format_align_left'
              : align === 'center' ? 'format_align_center'
              : align === 'right' ? 'format_align_right'
              : 'format_align_justify'}
          </span>
        </button>
      ))}

      <div className="rv-office-document-toolbar-divider" />

      <div className="rv-office-margins-menu" ref={marginsMenuRef}>
        <button
          className={`rv-office-document-toolbar-btn${marginsMenuOpen ? ' rv-office-toolbar-btn--active' : ''}`}
          onClick={() => {
            setBrightnessMenuOpen(false);
            setMarginsMenuOpen((v) => !v);
          }}
          title="Page margins"
        >
          <span className="material-symbols-outlined">border_outer</span>
        </button>
        {marginsMenuOpen && (
          <div className="rv-office-margins-dropdown">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div key={side} className="rv-office-margins-row">
                <label>{side.charAt(0).toUpperCase() + side.slice(1)}</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={docSettings.margins[side]}
                  onChange={(e) => {
                    const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                    setDocSettings((s) => ({ ...s, margins: { ...s.margins, [side]: val } }));
                    markDirty();
                  }}
                />
              </div>
            ))}
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

      <div className="rv-office-document-toolbar-divider" />

      <PaperBrightnessControl
        value={paperBrightness}
        onChange={onPaperBrightnessChange}
        ariaLabel="Document brightness"
        open={brightnessMenuOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen) setMarginsMenuOpen(false);
          setBrightnessMenuOpen(nextOpen);
        }}
        buttonClassName="rv-office-document-toolbar-btn"
        buttonActiveClassName="rv-office-toolbar-btn--active"
      />
    </div>
  );
}
