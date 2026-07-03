/**
 * @module focus-state
 * @role Track whether the Fusion Studio application window is focused.
 *
 * Provides a small on-disk snapshot of the current focus state so that
 * other processes (e.g., the server) can read it without requiring an
 * IPC channel. Useful for deciding whether a system event, such as a
 * macOS screenshot, happened while the user was interacting with this app.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

let trackedWindow = null;
let isFocused = false;
let stateFilePath = null;

function getStateFilePath() {
  if (!stateFilePath) {
    stateFilePath = path.join(app.getPath('userData'), 'fusion-focus-state.json');
  }
  return stateFilePath;
}

function writeState() {
  try {
    fs.writeFileSync(
      getStateFilePath(),
      JSON.stringify({ focused: isFocused, updatedAt: Date.now() }),
    );
  } catch (err) {
    console.error('[FocusState] Failed to write state:', err.message);
  }
}

function setFocused(value) {
  if (isFocused === value) return;
  isFocused = value;
  writeState();
}

/**
 * Begin tracking focus/blur events for the given BrowserWindow.
 * Call once after the main window is created.
 *
 * @param {import('electron').BrowserWindow} win
 */
function trackWindow(win) {
  if (trackedWindow) {
    console.warn('[FocusState] Already tracking a window — ignoring new trackWindow call');
    return;
  }

  trackedWindow = win;
  setFocused(win.isFocused());

  win.on('focus', () => setFocused(true));
  win.on('blur', () => setFocused(false));
}

/**
 * Returns the current in-process focus flag.
 * Other processes should read the file returned by getStateFilePath().
 *
 * @returns {boolean}
 */
function getIsFocused() {
  return isFocused;
}

module.exports = {
  trackWindow,
  getIsFocused,
  getStateFilePath,
};
