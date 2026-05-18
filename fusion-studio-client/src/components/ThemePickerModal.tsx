import { usePanelStore } from '../state/panelStore';
import ThemePicker from './ThemePicker';

export function ThemePickerModal() {
  const open = usePanelStore((s) => s.isThemePickerOpen);
  const setOpen = usePanelStore((s) => s.setThemePickerOpen);

  if (!open) return null;

  return (
    <>
      <div className="rv-theme-picker-scrim" onClick={() => setOpen(false)} />
      <div className="rv-theme-picker-modal">
        <ThemePicker onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
