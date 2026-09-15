/**
 * @module e2e/worksurface-harness
 * @role Shared Vite-built fixture for CHAT-03 / SPEC-03 e2e gates (03B–03D).
 *
 * Mounts the REAL production `ViewChatHost` over the real store, the real
 * worksurface controller, the real adapter registry (File Viewer, Wiki Viewer,
 * Capture Viewer, Office Viewer, Email Viewer), the real policy-ready Capture
 * connected-owner ports, and the real WebSocket frame handlers, with a
 * deterministic in-fixture server model driving `state:worksurface_get/put/
 * result/error` and a controllable `state:worksurface_changed` fan-out.
 *
 * No owner workspace, dev database, Alpha profile, or port 3001 is used.
 */

import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { build } from 'vite';

export const HARNESS_WORKSPACE = 'worksurface-workspace';
export const FILE_VIEW = 'file-viewer';
export const WIKI_VIEW = 'wiki-viewer';
export const CAPTURE_VIEW = 'capture-viewer';
export const OFFICE_VIEW = 'office-viewer';
export const EMAIL_VIEW = 'email-viewer';
export const FILE_GROUP_A = 'group-a';
export const FILE_GROUP_B = 'group-b';
export const FILE_GROUP_C = 'group-c';
export const FILE_THREAD_C = 'thread-c';
export const FILE_THREAD_A = 'thread-a';
export const FILE_THREAD_B = 'thread-b';
export const WIKI_GROUP_A = 'wiki-group-a';
export const WIKI_GROUP_B = 'wiki-group-b';
export const WIKI_THREAD_A = 'wiki-thread-a';
export const WIKI_THREAD_B = 'wiki-thread-b';
export const CAPTURE_GROUP_A = 'capture-group-a';
export const CAPTURE_GROUP_B = 'capture-group-b';
export const CAPTURE_THREAD_A = 'capture-thread-a';
export const CAPTURE_THREAD_B = 'capture-thread-b';
export const OFFICE_GROUP_A = 'office-group-a';
export const OFFICE_GROUP_B = 'office-group-b';
export const OFFICE_THREAD_A = 'office-thread-a';
export const OFFICE_THREAD_B = 'office-thread-b';
export const EMAIL_GROUP_A = 'email-group-a';
export const EMAIL_GROUP_B = 'email-group-b';
export const EMAIL_THREAD_A = 'email-thread-a';
export const EMAIL_THREAD_B = 'email-thread-b';
// SPEC-04 §11 04B: adapterless §6 hosts (no SPEC-03 dock/adapter).
export const ISSUES_VIEW = 'issues-viewer';
export const ISSUES_GROUP_A = 'issues-group-a';
export const ISSUES_GROUP_B = 'issues-group-b';
export const ISSUES_THREAD_A = 'issues-thread-a';
export const ISSUES_THREAD_B = 'issues-thread-b';

export interface HarnessStoreSnapshot {
  currentGroup: string | null;
  binding: Record<string, unknown> | null;
  pending: Record<string, unknown> | null;
  conflict: Record<string, unknown> | null;
  warnings: string[];
  remote: Record<string, unknown>;
  entries: Record<string, Record<string, unknown>>;
}

export interface HarnessControls {
  deliver(msg: unknown): void;
  sentRaw(): Array<Record<string, unknown>>;
  clearSent(): void;
  serverEntries(): Record<string, { content: unknown }>;
  setEntry(viewId: string, groupId: string, entry: unknown): void;
  forcePutError(code: string): void;
  holdNextPut(): void;
  releasePut(): void;
  holdPuts(count: number): void;
  releaseOneHeldPut(): void;
  heldPutCount(): number;
  holdNextGet(): void;
  releaseGet(): void;
  remoteWrite(viewId: string, groupId: string, content: unknown): Record<string, unknown>;
  flushView(viewId: string, reason: string): boolean;
  retry(viewId: string): boolean;
  discard(viewId: string): boolean;
  reconnect(): void;
  dropSocket(): void;
  resetController(): void;
  store(): HarnessStoreSnapshot;
  activity(viewId: string): { tabs: Array<{ path: string }>; activeTabId: string | null };
  wiki(): { history: string[]; historyIndex: number; viewedPath: string; selectedPath: string; rootReady: boolean };
  seedWiki(): void;
  selectWikiNode(path: string): void;
  viewState(viewId: string): Record<string, unknown> | null;
  setViewState(viewId: string, patch: Record<string, unknown>): void;
  persistContent(viewId: string): boolean;
  seedFileTree(viewId: string, folder: string, nodes: Array<Record<string, unknown>>): void;
  mountView(viewId: string): void;
  setViewActive(viewId: string, active: boolean): void;
  remount(): void;
}

function projection(
  viewId: string,
  groupId: string,
  threadId: string,
  name: string,
): Record<string, unknown> {
  return {
    threadId,
    threadGroupId: groupId,
    workspaceId: HARNESS_WORKSPACE,
    viewId,
    name,
    currentPrimaryThreadId: threadId,
    currentPrimarySequence: 1,
    memberCount: 1,
    createdAt: 1000,
    updatedAt: 2000,
    entry: {
      name,
      createdAt: '2026-01-01T00:00:00.000Z',
      messageCount: 1,
      status: 'active',
      harnessId: 'opencode',
      harnessConfig: { model: 'm1', variant: 'high' },
    },
  };
}

let cachedBundle: Promise<string> | null = null;

export function buildWorksurfaceHarness(): Promise<string> {
  if (cachedBundle) return cachedBundle;
  cachedBundle = (async () => {
    const virtualEntry = 'virtual:thread-worksurface-harness-03b';
    const resolvedEntry = `\0${virtualEntry}`;
    const modulePaths = {
      panelStore: path.resolve('src/state/panelStore.ts'),
      workspaceStore: path.resolve('src/state/workspaceStore.ts'),
      fileStore: path.resolve('src/state/fileStore.ts'),
      fileDataStore: path.resolve('src/state/fileDataStore.ts'),
      wikiStore: path.resolve('src/state/wikiStore.ts'),
      viewActivity: path.resolve('src/lib/viewActivity.ts'),
      host: path.resolve('src/components/chat/ViewWorksurfaceDock.tsx'),
      threadHandlers: path.resolve('src/lib/ws/thread-handlers.ts'),
      worksurfaceHandlers: path.resolve('src/lib/ws/worksurface-handlers.ts'),
      controller: path.resolve('src/lib/worksurface/worksurfaceController.ts'),
      builtins: path.resolve('src/lib/worksurface/builtins.ts'),
      officePersistence: path.resolve('src/components/office/officeViewerPersistence.ts'),
      emailPersistence: path.resolve('src/components/email/emailViewerPersistence.ts'),
      captureConnectedTabs: path.resolve('src/components/view-tabs/captureConnectedTabs.ts'),
      captureOwnerPorts: path.resolve('src/components/view-tabs/captureConnectedOwnerPorts.ts'),
      connectedAdapter: path.resolve('src/components/view-tabs/componentTabConnectedAdapter.ts'),
      viewCollections: path.resolve('src/lib/viewCollections.ts'),
      viewTabBar: path.resolve('src/components/view-tabs/ViewTabBar.tsx'),
    };
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { usePanelStore } from ${JSON.stringify(modulePaths.panelStore)};
      import { useWorkspaceStore } from ${JSON.stringify(modulePaths.workspaceStore)};
      import { useFileStore } from ${JSON.stringify(modulePaths.fileStore)};
      import { useFileDataStore } from ${JSON.stringify(modulePaths.fileDataStore)};
      import {
        useWikiStore, createWikiRootNode, createWikiNode,
      } from ${JSON.stringify(modulePaths.wikiStore)};
      import { replaceViewTabs, getViewActivity } from ${JSON.stringify(modulePaths.viewActivity)};
      import { ViewWorksurfaceDock } from ${JSON.stringify(modulePaths.host)};
      import { handleThreadMessage } from ${JSON.stringify(modulePaths.threadHandlers)};
      import { handleWorksurfaceMessage } from ${JSON.stringify(modulePaths.worksurfaceHandlers)};
      import {
        resetWorksurfaceController, setWorksurfaceRequestTimeout,
        reconcileWorksurfacesOnReconnect, reconcileSideChatPlacementsOnReconnect,
        retryPendingWorksurfaceCapture,
        discardPendingWorksurfaceConflict, flushBoundView, flushBoundWorkspaceViews,
        onViewContentChanged,
      } from ${JSON.stringify(modulePaths.controller)};
      import ${JSON.stringify(modulePaths.builtins)};
      import { persistOfficeViewPatch } from ${JSON.stringify(modulePaths.officePersistence)};
      import { persistEmailViewPatch } from ${JSON.stringify(modulePaths.emailPersistence)};
      import { applyCaptureClassicConversionOnce } from ${JSON.stringify(modulePaths.captureConnectedTabs)};
      import { createCaptureConnectedOwnerPorts } from ${JSON.stringify(modulePaths.captureOwnerPorts)};
      import { readyTabPolicyFor } from ${JSON.stringify(modulePaths.connectedAdapter)};
      import { removeViewPathReferences, rewriteViewPathReferences } from ${JSON.stringify(modulePaths.viewCollections)};
      import { ViewTabBar } from ${JSON.stringify(modulePaths.viewTabBar)};

      var WS = ${JSON.stringify(HARNESS_WORKSPACE)};
      var FILE_VIEW = ${JSON.stringify(FILE_VIEW)};
      var WIKI_VIEW = ${JSON.stringify(WIKI_VIEW)};
      var FILE_GROUP_A = ${JSON.stringify(FILE_GROUP_A)};
      var FILE_GROUP_B = ${JSON.stringify(FILE_GROUP_B)};
      var FILE_GROUP_C = ${JSON.stringify(FILE_GROUP_C)};
      var WIKI_GROUP_A = ${JSON.stringify(WIKI_GROUP_A)};
      var WIKI_GROUP_B = ${JSON.stringify(WIKI_GROUP_B)};
      var CAPTURE_VIEW = ${JSON.stringify(CAPTURE_VIEW)};
      var OFFICE_VIEW = ${JSON.stringify(OFFICE_VIEW)};
      var EMAIL_VIEW = ${JSON.stringify(EMAIL_VIEW)};
      var CAPTURE_GROUP_A = ${JSON.stringify(CAPTURE_GROUP_A)};
      var CAPTURE_GROUP_B = ${JSON.stringify(CAPTURE_GROUP_B)};
      var OFFICE_GROUP_A = ${JSON.stringify(OFFICE_GROUP_A)};
      var OFFICE_GROUP_B = ${JSON.stringify(OFFICE_GROUP_B)};
      var EMAIL_GROUP_A = ${JSON.stringify(EMAIL_GROUP_A)};
      var EMAIL_GROUP_B = ${JSON.stringify(EMAIL_GROUP_B)};
      var ISSUES_VIEW = ${JSON.stringify(ISSUES_VIEW)};
      var ISSUES_GROUP_A = ${JSON.stringify(ISSUES_GROUP_A)};
      var PROJ_A = ${JSON.stringify(projection(FILE_VIEW, FILE_GROUP_A, FILE_THREAD_A, 'Alpha'))};
      var PROJ_B = ${JSON.stringify(projection(FILE_VIEW, FILE_GROUP_B, FILE_THREAD_B, 'Beta'))};
      var PROJ_C = ${JSON.stringify(projection(FILE_VIEW, FILE_GROUP_C, FILE_THREAD_C, 'Gamma'))};
      var WIKI_PROJ_A = ${JSON.stringify(projection(WIKI_VIEW, WIKI_GROUP_A, WIKI_THREAD_A, 'Wiki Alpha'))};
      var WIKI_PROJ_B = ${JSON.stringify(projection(WIKI_VIEW, WIKI_GROUP_B, WIKI_THREAD_B, 'Wiki Beta'))};
      var CAPTURE_PROJ_A = ${JSON.stringify(projection(CAPTURE_VIEW, CAPTURE_GROUP_A, CAPTURE_THREAD_A, 'Capture Alpha'))};
      var CAPTURE_PROJ_B = ${JSON.stringify(projection(CAPTURE_VIEW, CAPTURE_GROUP_B, CAPTURE_THREAD_B, 'Capture Beta'))};
      var OFFICE_PROJ_A = ${JSON.stringify(projection(OFFICE_VIEW, OFFICE_GROUP_A, OFFICE_THREAD_A, 'Office Alpha'))};
      var OFFICE_PROJ_B = ${JSON.stringify(projection(OFFICE_VIEW, OFFICE_GROUP_B, OFFICE_THREAD_B, 'Office Beta'))};
      var EMAIL_PROJ_A = ${JSON.stringify(projection(EMAIL_VIEW, EMAIL_GROUP_A, EMAIL_THREAD_A, 'Email Alpha'))};
      var EMAIL_PROJ_B = ${JSON.stringify(projection(EMAIL_VIEW, EMAIL_GROUP_B, EMAIL_THREAD_B, 'Email Beta'))};
      var ISSUES_PROJ_A = ${JSON.stringify(projection(ISSUES_VIEW, ISSUES_GROUP_A, ISSUES_THREAD_A, 'Issues Alpha'))};

      var sent = [];
      var counter = 0;
      var forcedPutCode = null;
      var forcedPlacementCode = null;
      var holdNextPutActive = false;
      var heldPutFrame = null;
      var holdPutRemaining = 0;
      var heldPuts = [];
      var holdNextGetActive = false;
      var heldGetFrame = null;
      var server = { entries: {} };
      var mountedViews = [];
      var seededMembers = {};

      function mint(prefix) { counter += 1; return prefix + '-' + counter; }
      function entryKey(viewId, groupId) { return viewId + '::' + groupId; }
      function getServerEntry(viewId, groupId) { return server.entries[entryKey(viewId, groupId)] || null; }

      function deliver(msg) {
        if (handleThreadMessage(msg)) return;
        handleWorksurfaceMessage(msg);
      }
      function replyLater(fn) { setTimeout(fn, 0); }

      function broadcastChanged(viewId, groupId, lane) {
        var entry = getServerEntry(viewId, groupId);
        deliver({ type: 'state:worksurface_changed', workspaceId: WS, viewId: viewId, threadGroupId: groupId,
          lane: lane || 'content',
          contentRevision: entry ? entry.contentRevision : null,
          placementRevision: entry ? entry.placementRevision : null });
      }

      function handlePut(frame) {
        var current = getServerEntry(frame.viewId, frame.threadGroupId);
        var currentRev = current ? current.contentRevision : null;
        if (forcedPutCode) {
          var code = forcedPutCode;
          forcedPutCode = null;
          // A revision_conflict simulates a peer having advanced the entry: the
          // server returns its genuinely newer current revision for reconcile.
          if (current && code === 'revision_conflict') {
            current = JSON.parse(JSON.stringify(current));
            current.contentRevision = mint('cr');
            // A peer wrote DIFFERENT content, so the conflict is a genuine loss
            // (an identical capture would take the server's ack path instead).
            current.content = { remoteWrite: true };
            server.entries[entryKey(frame.viewId, frame.threadGroupId)] = current;
            currentRev = current.contentRevision;
          }
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'content', code: code,
            entry: current, contentRevision: currentRev, placementRevision: current ? current.placementRevision : null });
          return;
        }
        if (frame.expectedContentRevision !== currentRev) {
          if (current && current.adapterId === frame.adapterId && current.adapterVersion === frame.adapterVersion
            && JSON.stringify(current.content) === JSON.stringify(frame.content)) {
            deliver({ type: 'state:worksurface_result', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
              requestId: frame.requestId, workspaceId: WS, lane: 'content', applied: false, acknowledged: true,
              entry: current, contentRevision: current.contentRevision, placementRevision: current.placementRevision });
            return;
          }
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'content', code: 'revision_conflict',
            entry: current, contentRevision: currentRev, placementRevision: current ? current.placementRevision : null });
          return;
        }
        var entry = {
          schemaVersion: 1,
          adapterId: frame.adapterId,
          adapterVersion: frame.adapterVersion,
          contentRevision: mint('cr'),
          placementRevision: current ? current.placementRevision : mint('pr'),
          updatedAt: new Date().toISOString(),
          content: frame.content,
          managedComponentPlacements: current ? current.managedComponentPlacements : {},
        };
        server.entries[entryKey(frame.viewId, frame.threadGroupId)] = entry;
        deliver({ type: 'state:worksurface_result', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
          requestId: frame.requestId, workspaceId: WS, lane: 'content', applied: true,
          entry: entry, contentRevision: entry.contentRevision, placementRevision: entry.placementRevision });
        broadcastChanged(frame.viewId, frame.threadGroupId, 'content');
      }

      function handlePlacement(frame) {
        var current = getServerEntry(frame.viewId, frame.threadGroupId);
        if (forcedPlacementCode) {
          var forced = forcedPlacementCode;
          forcedPlacementCode = null;
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'placement', code: forced,
            entry: current, contentRevision: current ? current.contentRevision : null,
            placementRevision: current ? current.placementRevision : null });
          return;
        }
        if (!current) {
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'placement', code: 'not_found' });
          return;
        }
        if (frame.expectedPlacementRevision !== current.placementRevision) {
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'placement', code: 'revision_conflict',
            entry: current, contentRevision: current.contentRevision, placementRevision: current.placementRevision });
          return;
        }
        var next = JSON.parse(JSON.stringify(current));
        var record = next.managedComponentPlacements
          ? next.managedComponentPlacements[frame.placementId]
          : null;
        if (!record) {
          deliver({ type: 'state:worksurface_error', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
            requestId: frame.requestId, workspaceId: WS, lane: 'placement', code: 'not_found',
            entry: current, contentRevision: current.contentRevision, placementRevision: current.placementRevision });
          return;
        }
        if (frame.operation === 'close') {
          record.disposition = 'closed';
        } else if (frame.operation === 'upsert') {
          record.disposition = 'open';
          if (frame.descriptor) record.descriptor = frame.descriptor;
        }
        record.updatedAt = new Date().toISOString();
        // A placement mutation advances only the placement lane.
        next.placementRevision = mint('pr');
        server.entries[entryKey(frame.viewId, frame.threadGroupId)] = next;
        deliver({ type: 'state:worksurface_result', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
          requestId: frame.requestId, workspaceId: WS, lane: 'placement', applied: true,
          entry: next, contentRevision: next.contentRevision, placementRevision: next.placementRevision });
        broadcastChanged(frame.viewId, frame.threadGroupId, 'placement');
      }

      function replyGet(frame) {        var entry = getServerEntry(frame.viewId, frame.threadGroupId);
        replyLater(function () { deliver({ type: 'state:worksurface_result', viewId: frame.viewId, threadGroupId: frame.threadGroupId,
          requestId: frame.requestId, workspaceId: WS, lane: 'content', entry: entry,
          contentRevision: entry ? entry.contentRevision : null, placementRevision: entry ? entry.placementRevision : null }); });
      }

      function handleClientFrame(frame) {
        if (frame.type === 'thread:list') {
          var rows = frame.viewId === WIKI_VIEW ? [WIKI_PROJ_A, WIKI_PROJ_B]
            : frame.viewId === CAPTURE_VIEW ? [CAPTURE_PROJ_A, CAPTURE_PROJ_B]
            : frame.viewId === OFFICE_VIEW ? [OFFICE_PROJ_A, OFFICE_PROJ_B]
            : frame.viewId === EMAIL_VIEW ? [EMAIL_PROJ_A, EMAIL_PROJ_B]
            : frame.viewId === ISSUES_VIEW ? [ISSUES_PROJ_A]
            : [PROJ_A, PROJ_B, PROJ_C];
          replyLater(function () { deliver({ type: 'thread:list', viewId: frame.viewId === undefined ? null : frame.viewId, threads: rows }); });
        } else if (frame.type === 'thread:open') {
          replyLater(function () { deliver({ type: 'thread:opened', threadId: frame.threadId || 't', threadGroupId: frame.threadGroupId,
            workspaceId: WS, viewId: frame.viewId, thread: { name: 't', createdAt: '2026-01-01T00:00:00.000Z', messageCount: 1, status: 'active' },
            history: [{ role: 'user', content: 'hi' }], exchanges: [] }); });
        } else if (frame.type === 'state:worksurface_get') {
          if (holdNextGetActive) { holdNextGetActive = false; heldGetFrame = frame; return; }
          replyGet(frame);
        } else if (frame.type === 'state:worksurface_put') {
          if (holdNextPutActive) { holdNextPutActive = false; heldPutFrame = frame; return; }
          if (holdPutRemaining > 0) { holdPutRemaining -= 1; heldPuts.push(frame); return; }
          replyLater(function () { handlePut(frame); });
        } else if (frame.type === 'state:worksurface_placement') {
          replyLater(function () { handlePlacement(frame); });
        } else if (frame.type === 'thread:members') {
          replyLater(function () { deliver({ type: 'thread:members', threadGroupId: frame.threadGroupId,
            workspaceId: WS, viewId: FILE_VIEW,
            members: JSON.parse(JSON.stringify(seededMembers[frame.threadGroupId] || [])) }); });
        } else if (frame.type === 'thread:action' && frame.action === 'open_member_in_side') {
          // SPEC-04 §8: reopen/focus the member's lifetime placement and echo
          // the durable member identity so the renderer can focus the tab.
          replyLater(function () {
            var entry = getServerEntry(FILE_VIEW, frame.threadGroupId);
            var placementId = null;
            if (entry && entry.managedComponentPlacements) {
              Object.keys(entry.managedComponentPlacements).forEach(function (pid) {
                var rec = entry.managedComponentPlacements[pid];
                if (rec && rec.descriptor && rec.descriptor.input
                  && rec.descriptor.input.threadId === frame.threadId) {
                  rec.disposition = 'open';
                  rec.updatedAt = new Date().toISOString();
                  placementId = pid;
                }
              });
              if (placementId) {
                entry.placementRevision = mint('pr');
                server.entries[entryKey(FILE_VIEW, frame.threadGroupId)] = entry;
              }
            }
            deliver({ type: 'thread:action:completed', action: 'open_member_in_side',
              requestId: frame.requestId, threadGroupId: frame.threadGroupId, threadId: frame.threadId,
              workspaceId: WS, viewId: FILE_VIEW,
              sideChatPlacementId: placementId || ('scp-member-' + frame.threadId),
              placementStatus: 'applied' });
            if (entry) broadcastChanged(FILE_VIEW, frame.threadGroupId, 'placement');
          });
        }
      }

      function makeWs() {
        return {
          readyState: 1,
          send: function (data) { var frame = JSON.parse(data); sent.push(frame); handleClientFrame(frame); },
          addEventListener: function () {}, removeEventListener: function () {}, close: function () {},
        };
      }
      var fakeWs = makeWs();

      function emptyChat(label) {
        return { messages: [{ id: label + '-u1', type: 'user', content: label, timestamp: 1 }],
          currentTurn: null, pendingTurnEnd: false, pendingPromptAcceptance: null,
          retryPromptDraft: null, pendingMessage: null, segments: [], lastReleasedSegmentCount: 0, activity: null };
      }

      function seedWikiRoot() {
        var guide = createWikiNode({ name: '000-guide', path: '000-guide', kind: 'article', depth: 1 });
        var alpha = createWikiNode({ name: 'Alpha', path: 'Alpha', kind: 'article', depth: 1 });
        var beta = createWikiNode({ name: 'Beta', path: 'Beta', kind: 'article', depth: 1 });
        useWikiStore.getState().setRoot(createWikiRootNode([guide, alpha, beta]));
      }

      function resetStore() {
        resetWorksurfaceController();
        useWikiStore.getState().reset();
        usePanelStore.setState({
          activeWorkspaceId: WS,
          currentPanel: FILE_VIEW,
          ws: fakeWs,
          currentThreadId: null,
          chatActive: false,
          threads: [],
          threadGroupsByWorkspaceAndView: { [WS]: {
            [FILE_VIEW]: [PROJ_A, PROJ_B, PROJ_C],
            [WIKI_VIEW]: [WIKI_PROJ_A, WIKI_PROJ_B],
            [CAPTURE_VIEW]: [CAPTURE_PROJ_A, CAPTURE_PROJ_B],
            [OFFICE_VIEW]: [OFFICE_PROJ_A, OFFICE_PROJ_B],
            [EMAIL_VIEW]: [EMAIL_PROJ_A, EMAIL_PROJ_B],
          } },
          currentThreadGroupIdByWorkspaceAndView: {},
          legacyThreadGroupsByWorkspaceId: {},
          currentLegacyThreadGroupIdByWorkspaceId: {},
          pendingThreadOpens: [],
          projectChats: { 'thread-a': emptyChat('A'), 'thread-b': emptyChat('B'), 'thread-c': emptyChat('C'), 'wiki-thread-a': emptyChat('WA'), 'wiki-thread-b': emptyChat('WB'),
            'capture-thread-a': emptyChat('CA'), 'capture-thread-b': emptyChat('CB'),
            'office-thread-a': emptyChat('OA'), 'email-thread-a': emptyChat('EA'),
            'issues-thread-a': emptyChat('IA'), 'issues-thread-b': emptyChat('IB') },
          contextUsageByThread: {}, tokenUsageByThread: {}, wireReadyByThread: {}, harnessSelectionByThread: {},
          viewStates: {},
          // Policy-ready configuration: a shipped capture tabs policy so the
          // VIEW-02 connected records lane is the visible Capture tab surface.
          tabPolicies: {
            [CAPTURE_VIEW]: {
              status: 'ready',
              policy: {
                initial: { kind: 'launcher', launcherId: 'capture.home' },
                empty: {
                  tabLabel: 'New Capture Tab',
                  locationLabel: 'New Capture Tab',
                  launcherIds: ['capture.home'],
                },
                plus: { enabled: true },
                location: { omitTerminalNames: [], historyControls: 'none' },
                newTab: { blankKind: 'home', autoOpenDrawer: false },
              },
            },
            // SPEC-04 04A: a ready File policy so the real connected File rail
            // (the Side Chat bridge host) engages.
            [FILE_VIEW]: {
              status: 'ready',
              policy: {
                initial: { kind: 'empty' },
                plus: { enabled: true },
                empty: { tabLabel: 'New File Tab', locationLabel: 'New File Tab', launcherIds: ['file.open'] },
                location: { omitTerminalNames: [], historyControls: 'none' },
                newTab: { blankKind: 'empty', autoOpenDrawer: true },
              },
            },
          },
          worksurfaceBindings: {}, worksurfacePendingCaptures: {}, worksurfaceEntries: {},
          worksurfaceRemoteRevisions: {}, worksurfaceConflicts: {}, worksurfaceWarnings: [],
        });
        useWorkspaceStore.setState({ hasReceivedInit: true });
        useFileStore.getState().reset();
        useFileDataStore.getState().clearAll();
      }

      var gen = 0;
      var root = null;
      var rails = {};

      function Fixture() {
        return React.createElement('div', { id: 'worksurface-host' },
          mountedViews.map(function (view) {
            return React.createElement('div', { key: view.viewId, 'data-host-view': view.viewId },
              React.createElement(ViewWorksurfaceDock, {
                key: view.viewId, panel: view.viewId, workspaceId: WS, viewId: view.viewId, isActive: view.active,
              }));
          }),
          Object.keys(rails).map(function (viewId) {
            if (!rails[viewId]) return null;
            // The File rail wrapper keeps its accepted 04A id; other views get
            // a per-view wrapper id.
            var wrapperId = viewId === FILE_VIEW ? 'file-view-tab-rail' : viewId + '-view-tab-rail';
            return React.createElement('div', { key: viewId + '-rail', id: wrapperId },
              React.createElement(ViewTabBar, { panel: viewId },
                React.createElement('div', { className: 'rv-native-' + viewId + '-children' },
                  'native ' + viewId + ' surface')));
          }));
      }
      function render() { gen += 1; root.render(React.createElement(Fixture, { key: gen })); }

      function storeSnapshot() {
        var s = usePanelStore.getState();
        var viewId = (mountedViews[0] && mountedViews[0].viewId) || FILE_VIEW;
        var workspaceId = WS;
        var pending = s.worksurfacePendingCaptures[workspaceId + '::' + viewId] || null;
        var binding = s.worksurfaceBindings[workspaceId + '::' + viewId] || null;
        var conflict = s.worksurfaceConflicts[workspaceId + '::' + viewId] || null;
        var remote = {};
        Object.keys(s.worksurfaceRemoteRevisions).forEach(function (k) { remote[k] = s.worksurfaceRemoteRevisions[k]; });
        var entries = {};
        Object.keys(s.worksurfaceEntries).forEach(function (k) { entries[k] = s.worksurfaceEntries[k]; });
        return {
          currentGroup: ((s.currentThreadGroupIdByWorkspaceAndView[workspaceId] || {})[viewId]) || null,
          binding: binding,
          pending: pending,
          conflict: conflict,
          warnings: s.worksurfaceWarnings.slice(),
          remote: remote,
          entries: entries,
        };
      }

      function install() {
        setWorksurfaceRequestTimeout(1500);
        mountedViews = [{ viewId: FILE_VIEW, active: true }];
        resetStore();
        root = createRoot(document.querySelector('#root'));
        render();
        window.__wsFixture = {
          deliver: deliver,
          sentRaw: function () { return sent.slice(); },
          clearSent: function () { sent.length = 0; },
          serverEntries: function () { return JSON.parse(JSON.stringify(server.entries)); },
          setEntry: function (viewId, groupId, entry) { server.entries[entryKey(viewId, groupId)] = entry; },
          forcePutError: function (code) { forcedPutCode = code || 'worksurface_failed'; },
          holdNextPut: function () { holdNextPutActive = true; },
          releasePut: function () {
            holdNextPutActive = false;
            if (heldPutFrame) { var frame = heldPutFrame; heldPutFrame = null; handlePut(frame); }
          },
          holdPuts: function (count) { holdPutRemaining = count; },
          releaseOneHeldPut: function () {
            if (heldPuts.length === 0) return;
            var frame = heldPuts.shift();
            handlePut(frame);
          },
          heldPutCount: function () { return heldPuts.length; },
          holdNextGet: function () { holdNextGetActive = true; },
          releaseGet: function () {
            holdNextGetActive = false;
            if (heldGetFrame) { var frame = heldGetFrame; heldGetFrame = null; replyGet(frame); }
          },
          remoteWrite: function (viewId, groupId, content) {
            var current = getServerEntry(viewId, groupId);
            var entry = {
              schemaVersion: 1,
              adapterId: current ? current.adapterId : viewId,
              adapterVersion: current ? current.adapterVersion : 1,
              contentRevision: mint('cr'),
              placementRevision: current ? current.placementRevision : mint('pr'),
              updatedAt: new Date().toISOString(),
              content: content,
              managedComponentPlacements: current ? current.managedComponentPlacements : {},
            };
            server.entries[entryKey(viewId, groupId)] = entry;
            broadcastChanged(viewId, groupId, 'content');
            return JSON.parse(JSON.stringify(entry));
          },
          flushView: function (viewId, reason) { return flushBoundView(WS, viewId, reason); },
          flushWorkspace: function (reason) { return flushBoundWorkspaceViews(WS, reason); },
          retry: function (viewId) { return retryPendingWorksurfaceCapture(WS, viewId); },
          discard: function (viewId) { return discardPendingWorksurfaceConflict(WS, viewId); },
          reconnect: function () {
            resetWorksurfaceController();
            usePanelStore.setState({ ws: fakeWs });
            reconcileWorksurfacesOnReconnect();
          },
          // SPEC-04 §7 dockless restart trigger: seed the discovered panel
          // configs and run the unbound chat-capable placement sweep exactly as
          // the workspace-bind bootstrap does on relaunch.
          setPanelConfigs: function (viewIds) {
            usePanelStore.setState({
              panelConfigs: (viewIds || []).map(function (id) {
                return { id: id, name: id, icon: 'tab' };
              }),
            });
          },
          reconcileSideChats: function () { reconcileSideChatPlacementsOnReconnect(); },
          dropSocket: function () { usePanelStore.setState({ ws: null }); },
          resetController: function () { resetWorksurfaceController(); },
          store: storeSnapshot,
          replaceTabs: function (tabs, activeTabId) {
            var viewId = (mountedViews[0] && mountedViews[0].viewId) || FILE_VIEW;
            replaceViewTabs(viewId, tabs, activeTabId);
          },
          viewState: function (viewId) {
            var vs = usePanelStore.getState().viewStates[viewId];
            return vs ? JSON.parse(JSON.stringify(vs)) : null;
          },
          setViewState: function (viewId, patch) {
            usePanelStore.getState().setViewState(viewId, patch);
          },
          persistContent: function (viewId) { return onViewContentChanged(viewId); },
          persistOfficePatch: function (patch) { persistOfficeViewPatch(patch); },
          persistEmailPatch: function (patch) { persistEmailViewPatch(patch); },
          clearBinding: function (viewId) {
            var target = viewId || CAPTURE_VIEW;
            usePanelStore.getState().clearWorksurfaceBinding(WS, target);
          },
          removePathReferences: function (reference) { removeViewPathReferences(reference); },
          rewritePathReferences: function (reference) { rewriteViewPathReferences(reference); },
          capturePolicyReady: function () {
            return readyTabPolicyFor(usePanelStore.getState().tabPolicies, CAPTURE_VIEW) !== null;
          },
          applyCaptureRecords: function (collection) {
            var ports = createCaptureConnectedOwnerPorts({ workspaceId: WS });
            ports.applyCollection(collection);
          },
          applyClassicConversion: function () {
            window.__wsConversionApplied = false;
            applyCaptureClassicConversionOnce({
              readCollection: function () { return { tabs: [], activeTabId: null, reservations: [] }; },
              applyCollection: function () { window.__wsConversionApplied = true; },
              mintTabId: function () { return 'cvt-test'; },
              mintComponentInstanceId: function () { return 'cvi-test'; },
            });
            return window.__wsConversionApplied;
          },
          seedFileTree: function (viewId, folder, nodes) {
            var key = viewId + ':' + folder;
            var trees = {};
            trees[key] = nodes;
            useFileDataStore.setState({ trees: Object.assign({}, useFileDataStore.getState().trees, trees) });
          },
          activity: function (viewId) { return getViewActivity(viewId); },
          wiki: function () {
            var w = useWikiStore.getState();
            return { history: w.history.slice(), historyIndex: w.historyIndex,
              viewedPath: w.viewedPath, selectedPath: w.selectedPath, rootReady: !!w.root };
          },
          seedWiki: function () { seedWikiRoot(); },
          selectWikiNode: function (path) {
            var w = useWikiStore.getState();
            var node = w.root ? (function find(n) {
              if (!n) return null;
              if (n.path === path) return n;
              for (var i = 0; i < n.children.length; i += 1) { var f = find(n.children[i]); if (f) return f; }
              return null;
            })(w.root) : null;
            if (node) w.selectNode(node);
          },
          forceBinding: function (groupId, targetViewId) {
            var viewId = targetViewId || (mountedViews[0] && mountedViews[0].viewId) || FILE_VIEW;
            var s = usePanelStore.getState();
            s.setWorksurfaceBinding({ workspaceId: WS, viewId: viewId, threadGroupId: groupId,
              adapterId: viewId, adapterVersion: 1, contentRevision: 'forced-cr', placementRevision: 'forced-pr' });
            s.setCurrentThreadGroupId(WS, viewId, groupId);
          },
          mountView: function (viewId) { mountedViews = [{ viewId: viewId, active: true }]; render(); },
          mountRail: function () { rails[FILE_VIEW] = true; render(); },
          unmountRail: function () { delete rails[FILE_VIEW]; render(); },
          mountRailFor: function (viewId) { rails[viewId] = true; render(); },
          unmountRailFor: function (viewId) { delete rails[viewId]; render(); },
          seedPlacementEntry: function (viewId, groupId, placementId, threadId) {
            var current = getServerEntry(viewId, groupId);
            var entry = current ? JSON.parse(JSON.stringify(current)) : {
              schemaVersion: 1, adapterId: viewId, adapterVersion: 1,
              contentRevision: mint('cr'), placementRevision: mint('pr'),
              updatedAt: new Date().toISOString(), content: null, managedComponentPlacements: {},
            };
            entry.managedComponentPlacements[placementId] = {
              placementId: placementId,
              disposition: 'open',
              descriptor: {
                schemaVersion: 1,
                componentTypeId: 'fusion.chat-surface',
                componentInstanceId: 'chat-side:' + placementId,
                targetKey: placementId,
                input: { workspaceId: WS, viewId: viewId, threadGroupId: groupId, threadId: threadId, host: 'side-tab' },
              },
              updatedAt: new Date().toISOString(),
            };
            server.entries[entryKey(viewId, groupId)] = entry;
            usePanelStore.getState().setWorksurfaceEntry(WS, viewId, groupId, JSON.parse(JSON.stringify(entry)));
            render();
            return JSON.parse(JSON.stringify(entry));
          },
          seedSidePlacement: function (groupId, placementId, threadId) {
            return window.__wsFixture.seedPlacementEntry(FILE_VIEW, groupId, placementId, threadId);
          },
          seedSidePlacementIn: function (viewId, groupId, placementId, threadId) {
            return window.__wsFixture.seedPlacementEntry(viewId, groupId, placementId, threadId);
          },
          sidePlacements: function (groupId) {
            var entry = getServerEntry(FILE_VIEW, groupId);
            return entry && entry.managedComponentPlacements
              ? Object.keys(entry.managedComponentPlacements)
              : [];
          },
          population: function (viewId) {
            var rows = (usePanelStore.getState().threadGroupsByWorkspaceAndView[WS] || {})[viewId || FILE_VIEW] || [];
            return JSON.parse(JSON.stringify(rows));
          },
          // SPEC-04 §7 retry-path fixture: write only the SERVER entry (with
          // explicit lane revisions) so a placement-only fan-out can be proven
          // to drive the client re-read without any direct store seed.
          seedServerPlacementEx: function (groupId, placementId, threadId, contentRevision, placementRevision) {
            var entry = {
              schemaVersion: 1, adapterId: 'file-viewer', adapterVersion: 1,
              contentRevision: contentRevision, placementRevision: placementRevision,
              updatedAt: new Date().toISOString(), content: null, managedComponentPlacements: {},
            };
            entry.managedComponentPlacements[placementId] = {
              placementId: placementId,
              disposition: 'open',
              descriptor: {
                schemaVersion: 1,
                componentTypeId: 'fusion.chat-surface',
                componentInstanceId: 'chat-side:' + placementId,
                targetKey: placementId,
                input: { workspaceId: WS, viewId: FILE_VIEW, threadGroupId: groupId, threadId: threadId, host: 'side-tab' },
              },
              updatedAt: new Date().toISOString(),
            };
            server.entries[entryKey(FILE_VIEW, groupId)] = entry;
            return JSON.parse(JSON.stringify(entry));
          },
          broadcastPlacement: function (viewId, groupId) {
            broadcastChanged(viewId || FILE_VIEW, groupId, 'placement');
          },
          // Writes ONLY the server entry (no store seed) so a placement-lane
          // read (e.g. the Move completion re-read) is what materializes the
          // Side Chat tab. Generic over any registered chat-capable view.
          seedServerPlacementIn: function (viewId, groupId, placementId, threadId, contentRevision, placementRevision) {
            var entry = {
              schemaVersion: 1, adapterId: viewId, adapterVersion: 1,
              contentRevision: contentRevision || mint('cr'),
              placementRevision: placementRevision || mint('pr'),
              updatedAt: new Date().toISOString(), content: null, managedComponentPlacements: {},
            };
            entry.managedComponentPlacements[placementId] = {
              placementId: placementId,
              disposition: 'open',
              descriptor: {
                schemaVersion: 1,
                componentTypeId: 'fusion.chat-surface',
                componentInstanceId: 'chat-side:' + placementId,
                targetKey: placementId,
                input: { workspaceId: WS, viewId: viewId, threadGroupId: groupId, threadId: threadId, host: 'side-tab' },
              },
              updatedAt: new Date().toISOString(),
            };
            server.entries[entryKey(viewId, groupId)] = entry;
            return JSON.parse(JSON.stringify(entry));
          },
          setActiveSideChatPlacement: function (viewId, placementId) {
            usePanelStore.getState().setActiveSideChatPlacement(WS, viewId, placementId);
            render();
          },
          forcePlacementError: function (code) { forcedPlacementCode = code; },
          placementDisposition: function (groupId, placementId) {
            var entry = getServerEntry(FILE_VIEW, groupId);
            var record = entry && entry.managedComponentPlacements
              ? entry.managedComponentPlacements[placementId]
              : null;
            return record ? record.disposition : null;
          },
          seedMembers: function (groupId, members) {
            seededMembers[groupId] = members;
          },
          messages: function (threadId) {
            var s = usePanelStore.getState();
            var chat = s.projectChats[threadId];
            return chat ? JSON.parse(JSON.stringify(chat.messages || [])) : [];
          },
          setThreadFinalizing: function (threadId, value) {            var s = usePanelStore.getState();
            var chats = Object.assign({}, s.projectChats);
            chats[threadId] = Object.assign({}, chats[threadId] || {}, { pendingTurnEnd: !!value });
            usePanelStore.setState({ projectChats: chats });
            render();
          },
          mountViews: function (views) { mountedViews = views.slice(); render(); },
          setViewActive: function (viewId, active) {
            mountedViews = mountedViews.map(function (v) { return v.viewId === viewId ? { viewId: viewId, active: active } : v; });
            render();
          },
          remount: function () { resetStore(); render(); },
        };
      }

      install();
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'thread-worksurface-harness-03b',
        enforce: 'pre',
        resolveId(id) {
          if (id === virtualEntry) return resolvedEntry;
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return source;
          return null;
        },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: virtualEntry,
          output: { format: 'iife', name: 'ThreadWorksurfaceHarness03B' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Thread worksurface 03B harness did not build.');
    return chunk.code;
  })();
  return cachedBundle;
}

type FixtureWindow = {
  __wsFixture: Record<string, (...args: never[]) => unknown> & {
    store: () => HarnessStoreSnapshot;
    sentRaw: () => Array<Record<string, unknown>>;
    activity: (viewId: string) => { tabs: Array<{ path: string }>; activeTabId: string | null };
    wiki: () => { history: string[]; historyIndex: number; viewedPath: string; selectedPath: string; rootReady: boolean };
    serverEntries: () => Record<string, { content: unknown }>;
  };
};

/** Mount the shared harness and open the File Viewer dock (or another view). */
export async function mountHarness(
  page: Page,
  viewId: string = FILE_VIEW,
  options: { dock?: boolean } = {},
): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await buildWorksurfaceHarness() });
  await page.waitForFunction(() => Boolean((window as unknown as FixtureWindow).__wsFixture));
  // An adapterless host (§6 Issues/Agents/Browser) has no SPEC-03 dock; the
  // rail is mounted directly without a ViewWorksurfaceDock/ViewChatHost.
  if (options.dock === false) return;
  if (viewId !== FILE_VIEW) {
    await page.evaluate((target) => (
      window as unknown as { __wsFixture: { mountView: (v: string) => void } }
    ).__wsFixture.mountView(target), viewId);
  }
  try {
    await openDock(page, viewId);
  } catch (error) {
    if (errors.length > 0) throw new Error(errors.join('\n'));
    throw error;
  }
}

/**
 * The dock is collapsed by default in production; opening it is a real user
 * action that reveals the rail (the group-selection path).
 */
export async function openDock(page: Page, viewId: string): Promise<void> {
  const dock = page.locator(`[data-worksurface-dock="${viewId}"]`);
  const toggle = dock.locator('.rv-worksurface-dock-toggle');
  // Idempotent: the dock may already be open (SPEC-04 §3 mirrors the outer
  // rail's open state so a Side Chat's list button can operate it), so only
  // click when it is actually closed.
  if (await toggle.count() > 0 && await dock.getAttribute('data-open') !== 'true') {
    await toggle.first().click();
  }
  await expect(page.locator('#worksurface-host [data-threaded-chat]').first()).toBeVisible();
}

export async function fixtureStore(page: Page): Promise<HarnessStoreSnapshot> {
  return page.evaluate(() => (
    window as unknown as FixtureWindow
  ).__wsFixture.store());
}

export async function sentFrames(page: Page): Promise<Array<Record<string, unknown>>> {
  return page.evaluate(() => (
    window as unknown as FixtureWindow
  ).__wsFixture.sentRaw());
}

export async function fixtureActivity(
  page: Page,
  viewId: string,
): Promise<{ tabs: Array<{ path: string }>; activeTabId: string | null }> {
  return page.evaluate((target) => (
    window as unknown as FixtureWindow
  ).__wsFixture.activity(target), viewId);
}

export async function fixtureWiki(
  page: Page,
): Promise<{ history: string[]; historyIndex: number; viewedPath: string; selectedPath: string; rootReady: boolean }> {
  return page.evaluate(() => (
    window as unknown as FixtureWindow
  ).__wsFixture.wiki());
}

export async function serverEntries(
  page: Page,
): Promise<Record<string, { content: unknown }>> {
  return page.evaluate(() => (
    window as unknown as FixtureWindow
  ).__wsFixture.serverEntries());
}

export function fileTab(pathname: string, title: string) {
  return {
    id: `${FILE_VIEW}:${pathname}`,
    panel: FILE_VIEW,
    path: pathname,
    title,
    kind: 'file' as const,
    openedAt: 1,
  };
}
