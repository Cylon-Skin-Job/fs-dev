/**
 * ThemePickerButton — palette action in rv-header-right.
 * Clicking toggles the shared ThemePickerModal mounted by App.
 * See THEME_PICKER_SPEC.md §3a.
 */

import './ThemePicker.css';
import { usePanelStore } from '../state/panelStore';

export default function ThemePickerButton() {
  const open = usePanelStore((s) => s.isThemePickerOpen);
  const setOpen = usePanelStore((s) => s.setThemePickerOpen);

  return (
    <button
      className={`rv-theme-swatch-btn${open ? ' open' : ''}`}
      title="Workspace theme"
      onClick={() => setOpen(!open)}
      aria-label="Open theme picker"
      aria-expanded={open}
    >
      <span className="material-symbols-outlined">palette</span>
    </button>
  );
}
