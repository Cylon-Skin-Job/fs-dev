import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

// Characterization only. Later SPECs activate behavioral enforcement through
// the public-route runner; source shape alone is never a product oracle.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const sourcePaths = {
  sessionHost: 'fusion-studio-client/src/components/chat/useChatSessionHost.ts',
  sessionActions: 'fusion-studio-client/src/components/chat/useChatSessionActions.ts',
  viewHost: 'fusion-studio-client/src/components/chat/useViewChatHost.ts',
  threadManager: 'fusion-studio-server/lib/thread/ThreadManager.js',
  runtimeController: 'fusion-studio-server/lib/thread/thread-runtime-controller.js',
  wsHandler: 'fusion-studio-server/lib/thread/ThreadWebSocketHandler.js',
  automation: 'fusion-studio-server/lib/thread/thread-runtime-automation.js',
  sessionManager: 'fusion-studio-server/lib/thread/session-manager.js',
  runtimeManager: 'fusion-studio-server/lib/thread/thread-runtime-manager.js',
};

function readSource(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function detectAggregateHost(source) {
  const panelSubscriptions = count(source, /\busePanelStore\s*\(/g);
  const transcript = /(?:selector\(s\)\?\.messages|\bmessages\s*=\s*usePanelStore\s*\()/.test(source);
  const live = /(?:selector\(s\)\?\.segments|\bsegments\s*=\s*usePanelStore\s*\()/.test(source);
  const draft = /(?:draftsByOwner|\bcomposerDraft\s*=\s*useChatComposerDraftStore\s*\()/.test(source);
  const commandBridge = /addEventListener\(CHAT_ACTION_EVENT/.test(source);
  const promptLifecycle = /addEventListener\('fusion:prompt-accepted'/.test(source);
  return {
    panelSubscriptions,
    transcript,
    live,
    draft,
    commandBridge,
    promptLifecycle,
    aggregate: transcript && live && draft && commandBridge && promptLifecycle,
  };
}

function detectFullManagerInjection(source) {
  const matches = [...source.matchAll(/\bcreate[A-Za-z]*(?:Service|Controller)\s*\(\s*\{\s*manager\s*:\s*this\b/g)];
  return { count: matches.length, fullManagerInjection: matches.length > 0 };
}

function detectDuplicateRuntimeAuthority(source) {
  // A second mutable state map outside thread-runtime-manager is an authority
  // candidate. WS connection maps and SessionManager's provider-session map
  // are different responsibilities and intentionally excluded.
  const matches = [...source.matchAll(/(?:this\.)?(?:runtimeStates?|runtimeByThread|turnStates?|activeTurns?)\s*=\s*new\s+Map\s*\(/g)];
  return { count: matches.length, duplicateRuntimeAuthority: matches.length > 0 };
}

test('source-detector fixtures prove all three regression shapes are observable', () => {
  assert.equal(detectAggregateHost(`
    const messages = usePanelStore(x => x.messages);
    const segments = usePanelStore(x => x.segments);
    const composerDraft = useChatComposerDraftStore(x => x.draft);
    window.addEventListener(CHAT_ACTION_EVENT, handle);
    window.addEventListener('fusion:prompt-accepted', handle);
  `).aggregate, true);
  assert.equal(detectFullManagerInjection('createThreadGroupService({ manager: this })').fullManagerInjection, true);
  assert.equal(detectDuplicateRuntimeAuthority('this.runtimeStates = new Map()').duplicateRuntimeAuthority, true);
  assert.equal(detectDuplicateRuntimeAuthority('const runtimeByThread = new Map()').duplicateRuntimeAuthority, true);
  assert.equal(detectDuplicateRuntimeAuthority('this.activeSessions = new Map()').duplicateRuntimeAuthority, false);
});

test('current explicit-host contract inventory is complete and reproducible', (t) => {
  const sources = Object.fromEntries(Object.entries(sourcePaths).map(([key, relativePath]) => [key, readSource(relativePath)]));
  const hashes = Object.fromEntries(Object.entries(sources).map(([key, source]) => [key, createHash('sha256').update(source).digest('hex')]));
  const current = {
    aggregateSessionHost: detectAggregateHost(sources.sessionHost),
    aggregateSessionActions: detectAggregateHost(sources.sessionActions),
    aggregateViewHost: detectAggregateHost(sources.viewHost),
    fullManagerInjection: detectFullManagerInjection(sources.threadManager),
    duplicateRuntimeAuthorities: Object.fromEntries(
      ['threadManager', 'runtimeController', 'wsHandler', 'automation', 'sessionManager'].map((key) => [
        key,
        detectDuplicateRuntimeAuthority(sources[key]),
      ]),
    ),
    sharedRuntimeOwnerPresent: /\bthreadRuntimeManager\b/.test(sources.runtimeManager),
    sharedRuntimeOwnerUsedBy: Object.fromEntries(
      ['runtimeController', 'wsHandler', 'automation'].map((key) => [key, /\bthreadRuntimeManager\b/.test(sources[key])]),
    ),
  };
  assert.equal(Object.keys(hashes).length, 9);
  assert.equal(current.aggregateSessionHost.aggregate, false);
  assert.equal(current.aggregateSessionActions.aggregate, false);
  assert.equal(current.sharedRuntimeOwnerPresent, true);
  assert.deepEqual(Object.values(current.sharedRuntimeOwnerUsedBy), [true, true, true]);
  t.diagnostic(JSON.stringify({ lane: 'characterize', paths: sourcePaths, hashes, current }));
});

test('production shell has one explicit host placement and no Legacy compatibility surface', () => {
  const clientRoot = path.join(root, 'fusion-studio-client');
  assert.equal(existsSync(path.join(clientRoot, 'src/components/chat/useLegacyChatHost.ts')), false);
  assert.equal(existsSync(path.join(clientRoot, 'src/components/chat/LegacyChatHost.tsx')), false);
  assert.equal(existsSync(path.join(clientRoot, 'src/components/chat/ViewWorksurfaceDock.tsx')), false);

  const contract = readSource('fusion-studio-client/src/components/chat/chatSurfaceContract.ts');
  const registration = readSource('fusion-studio-client/src/components/chat/chatSurfaceRegistrationContract.ts');
  assert.equal(contract.includes('legacy-main'), false);
  assert.equal(registration.includes('legacy-main'), false);

  const shell = readSource('fusion-studio-client/src/components/WorkspacePanel.tsx');
  assert.equal(count(shell, /\buseViewChatHost\s*\(/g), 1);
  assert.match(shell, /<ViewChatShell[\s\S]*<ContentArea/);
  assert.doesNotMatch(shell, /ViewWorksurfaceDock|<ViewChatHost\b|\/ViewChatHost['"]/);

  const workspaceHandlers = readSource('fusion-studio-client/src/lib/ws/workspace-handlers.ts');
  const threadHandlers = readSource('fusion-studio-client/src/lib/ws/thread-handlers.ts');
  const worksurfaceFrames = readSource('fusion-studio-client/src/lib/worksurface/worksurfaceFrames.ts');
  assert.doesNotMatch(workspaceHandlers, /thread:list['"],?\s*viewId:\s*null/);
  assert.doesNotMatch(workspaceHandlers, /reconcileSideChatPlacementsOnReconnect/);
  assert.doesNotMatch(threadHandlers, /Auto-opening MRU|setCurrentThreadGroupId\(workspaceId,\s*null/);
  assert.doesNotMatch(worksurfaceFrames, /reconcileSideChatPlacementsOnReconnect|thread:list/);

  for (const relativePath of [
    'fusion-studio-client/src/components/capture/CaptureTiles.tsx',
    'fusion-studio-client/src/components/file-explorer/FileExplorer.tsx',
    'fusion-studio-client/src/components/wiki/WikiExplorer.tsx',
    'fusion-studio-client/src/components/office/OfficeGrid.tsx',
    'fusion-studio-client/src/components/email/EmailGrid.tsx',
  ]) {
    assert.doesNotMatch(readSource(relativePath), /ViewWorksurfaceDock|<ViewChatHost\b|\/ViewChatHost['"]/);
  }
});

test('04C changed production modules keep one job and stay within the 400-line rule', () => {
  for (const relativePath of [
    'fusion-studio-client/src/components/App.tsx',
    'fusion-studio-client/src/components/WorkspacePanel.tsx',
    'fusion-studio-client/src/components/ContentArea.tsx',
    'fusion-studio-client/src/components/ChatArea.tsx',
    'fusion-studio-client/src/components/chat/ChatSessionHost.tsx',
    'fusion-studio-client/src/components/chat/useChatSessionHost.ts',
    'fusion-studio-client/src/components/chat/useChatSessionActions.ts',
    'fusion-studio-client/src/components/chat/useViewChatHost.ts',
    'fusion-studio-client/src/components/chat/ViewChatHost.tsx',
    'fusion-studio-client/src/components/chat/ChatSurfaceComponentMount.tsx',
    'fusion-studio-client/src/components/chat/chatSurfaceContract.ts',
    'fusion-studio-client/src/components/chat/chatSurfaceRegistrationContract.ts',
  ]) {
    const lines = readSource(relativePath).split(/\r?\n/).length;
    assert.ok(lines <= 400, `${relativePath} has ${lines} physical lines`);
  }
});
