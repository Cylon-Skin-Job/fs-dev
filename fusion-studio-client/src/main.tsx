import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/document.css';
import 'material-symbols/outlined.css';
import App from './components/App';
import { startClipboardMonitor } from './clipboard';
import { subscribeClipboardBroadcasts } from './clipboard/clipboard-api';

// Start monitoring clipboard for new content
// This requires clipboard read permission which the user may need to grant
console.log('[main.tsx] Starting application bootstrap...');
startClipboardMonitor();
subscribeClipboardBroadcasts();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
