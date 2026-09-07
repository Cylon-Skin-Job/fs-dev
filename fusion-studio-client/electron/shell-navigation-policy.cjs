'use strict';

const { isShellMainFrameUrl, isShellUrl } = require('./shell-protocol.cjs');

function isAllowedMainFrameUrl(value) {
  return isShellMainFrameUrl(value);
}

function readFrameNavigation(args) {
  if (args[0] && typeof args[0] === 'object' && typeof args[0].url === 'string') {
    return { url: args[0].url, isMainFrame: args[0].isMainFrame === true };
  }
  if (args[1] && typeof args[1] === 'object') {
    return { url: args[1].url, isMainFrame: args[1].isMainFrame === true };
  }
  return { url: args[1], isMainFrame: args[4] === true };
}

function attachShellNavigationPolicy(webContents, {
  log,
  onMainFrameNavigation,
  trustedShellWindow = true,
} = {}) {
  const reject = (event, code) => {
    event.preventDefault();
    log?.(code);
  };

  webContents.on('will-navigate', (event, legacyUrl) => {
    const url = typeof event?.url === 'string' ? event.url : legacyUrl;
    const denied = trustedShellWindow ? !isAllowedMainFrameUrl(url) : isShellUrl(url);
    if (denied) {
      reject(event, 'main_navigation_denied');
    } else {
      onMainFrameNavigation?.();
    }
  });

  webContents.on('will-frame-navigate', (...args) => {
    const [event] = args;
    const navigation = readFrameNavigation(args);
    if (navigation.isMainFrame) {
      const denied = trustedShellWindow
        ? !isAllowedMainFrameUrl(navigation.url)
        : isShellUrl(navigation.url);
      if (denied) {
        reject(event, 'main_navigation_denied');
      } else {
        onMainFrameNavigation?.();
      }
      return;
    }
    if (isShellUrl(navigation.url)) reject(event, 'subframe_shell_denied');
  });

  webContents.on('will-attach-webview', (event, webPreferences, params) => {
    if (isShellUrl(params?.src)) reject(event, 'webview_shell_denied');
    if (webPreferences) delete webPreferences.preload;
  });

  webContents.setWindowOpenHandler(({ url }) => {
    if (isShellUrl(url)) {
      log?.('popup_shell_denied');
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
        },
      },
    };
  });

  webContents.on('did-create-window', (childWindow) => {
    if (childWindow?.webContents) {
      attachShellNavigationPolicy(childWindow.webContents, { log, trustedShellWindow: false });
    }
  });
}

function installSubframeHeaderPolicy(webContents) {
  webContents.session.webRequest.onHeadersReceived(
    { urls: ['<all_urls>'] },
    (details, callback) => {
      if (details.resourceType !== 'subFrame' || isShellUrl(details.url)) {
        callback({ responseHeaders: details.responseHeaders });
        return;
      }
      const headers = { ...details.responseHeaders };
      delete headers['X-Frame-Options'];
      delete headers['x-frame-options'];
      for (const name of ['Content-Security-Policy', 'content-security-policy']) {
        if (!headers[name]) continue;
        headers[name] = headers[name]
          .map((policy) => policy.replace(/frame-ancestors[^;]*;?/gi, '').trim())
          .filter(Boolean);
      }
      callback({ responseHeaders: headers });
    },
  );
}

module.exports = {
  attachShellNavigationPolicy,
  installSubframeHeaderPolicy,
  isAllowedMainFrameUrl,
  readFrameNavigation,
};
