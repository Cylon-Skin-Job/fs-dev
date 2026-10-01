/**
 * @module worksurface/viewContentKeys
 * @role Elected top-level `ViewUIState` content keys per participating view
 *       (CHAT-03 / SPEC-03 §5).
 *
 * This module has no imports beyond the view-state type so both the adapters
 * and the controller/ws-client hydration guard can share the key sets without a
 * module-init cycle. `activity` (File/Wiki and every view) is pinned separately.
 */

import type { ViewUIState } from '../../types';

export const CAPTURE_VIEWER_CONTENT_KEYS: ReadonlySet<keyof ViewUIState> = new Set([
  'docViewerMode',
  'docViewerActiveSelectedPath',
  'docViewerArchiveSelectedPath',
  'docViewerLastOpenedPath',
  'docViewerActiveGridScroll',
  'docViewerArchiveGridScroll',
  'docViewerActiveDocScroll',
  'docViewerArchiveDocScroll',
  'docViewerTabs',
  'docViewerActiveTabId',
  // The VIEW-02 connected records lane is the visible Capture tab surface when
  // the shipped `tabs` policy is ready; it is elected so that surface is
  // group-scoped and restored (03D M-1 repair).
  'captureTabRecords',
]);

export const OFFICE_VIEWER_CONTENT_KEYS: ReadonlySet<keyof ViewUIState> = new Set([
  'officeViewerMode',
  'officeViewerCurrentFolder',
  'officeViewerSelectedPath',
  'officeDocumentSidePanel',
]);

export const EMAIL_VIEWER_CONTENT_KEYS: ReadonlySet<keyof ViewUIState> = new Set([
  'emailViewerMode',
  'emailViewerCurrentFolder',
  'emailViewerSelectedPath',
  'emailDocumentSidePanel',
]);
