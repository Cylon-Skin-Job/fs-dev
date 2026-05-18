/**
 * Screenshot capture utility.
 *
 * One job: capture a DOM element as a PNG data URL.
 *
 * In Electron: uses native webContents.capturePage() — async, non-blocking.
 * In browser: disabled. DOM-to-image libraries freeze on complex panels.
 */

export async function captureElement(_el: HTMLElement | null): Promise<string | null> {
  // Browser capture is disabled to prevent freezes.
  // Electron mode uses IPC in useScreenshotCapture instead of this function.
  return null;
}

export function getPanelElement(panelId: string): HTMLElement | null {
  return document.querySelector(`[data-panel="${panelId}"]`) as HTMLElement | null;
}

export function getActivePanelElement(): HTMLElement | null {
  return document.querySelector('.rv-panel.active') as HTMLElement | null;
}
