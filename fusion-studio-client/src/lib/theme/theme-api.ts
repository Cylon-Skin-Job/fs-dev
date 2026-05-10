import { usePanelStore } from '../../state/panelStore';
import type { ThemeEntry } from '../../types';

export function saveTheme(theme: ThemeEntry): void {
  usePanelStore.getState().saveTheme(theme);
}

export function activateTheme(id: string): void {
  usePanelStore.getState().activateTheme(id);
}

export function deleteTheme(id: string): void {
  usePanelStore.getState().deleteTheme(id);
}

export function fetchThemes(): Promise<ThemeEntry[]> {
  return Promise.resolve(usePanelStore.getState().themes);
}
