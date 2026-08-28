import { useEffect, useRef, useState } from 'react';
import { usePanelStore } from '../state/panelStore';
import { ConnectorsDropdown } from './ConnectorsDropdown';
import '../styles/dropdown.css';
import './HeaderActionsMenu.css';

interface HeaderActionsMenuProps {
  onOpenFusion: () => void;
}

export function HeaderActionsMenu({ onOpenFusion }: HeaderActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const themePickerOpen = usePanelStore((state) => state.isThemePickerOpen);
  const setThemePickerOpen = usePanelStore((state) => state.setThemePickerOpen);
  const setConnectorsDropdownOpen = usePanelStore(
    (state) => state.setConnectorsDropdownOpen,
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setConnectorsDropdownOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setConnectorsDropdownOpen]);

  function handleToggleMenu() {
    setConnectorsDropdownOpen(false);
    setOpen((currentlyOpen) => !currentlyOpen);
  }

  function handleOpenConnectors() {
    setOpen(false);
    setConnectorsDropdownOpen(true);
  }

  function handleOpenFusion() {
    setOpen(false);
    onOpenFusion();
  }

  function handleToggleThemePicker() {
    setOpen(false);
    setThemePickerOpen(!themePickerOpen);
  }

  return (
    <div className="rv-header-actions-menu-wrap" ref={rootRef}>
      <button
        type="button"
        className="rv-fusion-icon-btn"
        title="Workspace controls"
        aria-label="Open workspace controls"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggleMenu}
      >
        <span className="material-symbols-outlined">discover_tune</span>
      </button>

      <div
        className="rv-dropdown rv-header-actions-menu"
        role="menu"
        data-open={open}
        aria-label="Workspace controls"
      >
        <button
          type="button"
          className="rv-dropdown-item"
          role="menuitem"
          onClick={handleOpenConnectors}
        >
          <span className="material-symbols-outlined">hub</span>
          <span>macOS Connectors</span>
        </button>
        <button
          type="button"
          className="rv-dropdown-item"
          role="menuitem"
          onClick={handleOpenFusion}
        >
          <span className="material-symbols-outlined">raven</span>
          <span>Fusion</span>
        </button>
        <button
          type="button"
          className="rv-dropdown-item"
          role="menuitem"
          onClick={handleToggleThemePicker}
        >
          <span className="material-symbols-outlined">palette</span>
          <span>Workspace theme</span>
        </button>
      </div>

      <ConnectorsDropdown />
    </div>
  );
}
