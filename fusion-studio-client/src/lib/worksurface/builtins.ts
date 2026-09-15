/**
 * @module worksurface/builtins
 * @role First-party adapter registration (SPEC-03 §12).
 *
 * Imported for its side effect by the worksurface controller and by focused
 * tests/fixtures. 03A registered the File Viewer; 03B adds the Wiki Viewer as
 * the next representative adapter. 03D adds the remaining in-scope built-in
 * views one user path at a time (Capture Viewer, Office Viewer, Email Viewer).
 */

import { registerWorksurfaceAdapter } from './registry';
import { fileViewerWorksurfaceAdapter } from './fileViewerWorksurfaceAdapter';
import { wikiViewerWorksurfaceAdapter } from './wikiViewerWorksurfaceAdapter';
import { captureViewerWorksurfaceAdapter } from './captureViewerWorksurfaceAdapter';
import { officeViewerWorksurfaceAdapter } from './officeViewerWorksurfaceAdapter';
import { emailViewerWorksurfaceAdapter } from './emailViewerWorksurfaceAdapter';

registerWorksurfaceAdapter(fileViewerWorksurfaceAdapter);
registerWorksurfaceAdapter(wikiViewerWorksurfaceAdapter);
registerWorksurfaceAdapter(captureViewerWorksurfaceAdapter);
registerWorksurfaceAdapter(officeViewerWorksurfaceAdapter);
registerWorksurfaceAdapter(emailViewerWorksurfaceAdapter);
