// gray-matter (used by front-matter.ts) calls Buffer.from() internally.
// Electron renderer runs without nodeIntegration, so Buffer is not a global.
// Polyfill it from the 'buffer' package before any other imports.
import { Buffer } from 'buffer';
(globalThis as unknown as Record<string, unknown>).Buffer = Buffer;

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/document.css';
import 'material-symbols/outlined.css';
import App from './components/App';
import { initializeClipboardMonitorFromConfig } from './clipboard';
import { subscribeClipboardBroadcasts } from './clipboard/clipboard-api';
import { reactRootErrorOptions } from './reactRootErrorPolicy';

console.log('[main.tsx] Starting application bootstrap...');
initializeClipboardMonitorFromConfig();
subscribeClipboardBroadcasts();

createRoot(document.getElementById('root')!, reactRootErrorOptions).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Electron/macOS: compositor sometimes drops the layer after minimize — nudge a repaint.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const root = document.getElementById('root');
  if (!root) return;
  root.style.transform = 'translateZ(0)';
  requestAnimationFrame(() => {
    root.style.transform = '';
  });
});
