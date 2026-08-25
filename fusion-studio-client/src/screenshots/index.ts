/**
 * @module screenshots
 * @role Lightweight screenshots gallery using direct file paths
 *
 * Reads from ai/<machine>/Data/Screenshots in the active workspace via Electron IPC.
 */

export { ScreenshotsTrigger } from './ScreenshotsTrigger';
export { ScreenshotFlashOverlay } from './ScreenshotFlashOverlay';
export { captureAndAttachScreenshot, SCREENSHOT_FLASH_EVENT } from './chatScreenshotCapture';
