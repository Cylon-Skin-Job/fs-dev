/**
 * @module e2e/chat-component-registration.spec
 * @role SPEC-02 Slice 02C gate: code-owned `fusion.chat-surface` registration
 *       through the accepted Generic Host resolver seam, exercised end to end
 *       in the public rendered `ViewTabBar` / `ComponentTabPanel` / resolver
 *       path.
 *
 * Proof strategy:
 *  - dependency-free contract unit checks for strict input parsing and the
 *    transient `surfaceId` derivation;
 *  - source sweeps for the closed registration seam and durable-only input;
 *  - a real Vite-rendered fixture mounting the actual `ViewTabBar` with a
 *    component tab resolved by `createFirstPartyComponentResolver` over
 *    `chatConnectedRegistrations()`.
 *
 * No owner workspace, dev database, or port 3001 is used. The isolated config
 * (port 3316, /tmp profile) is only needed for the app-boot lane and is never
 * touched by the rendered fixture.
 */

import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import {
  mintChatComponentSurfaceId,
  parseChatSurfaceDescriptorInput,
} from '../src/components/chat/chatSurfaceRegistrationContract';

const ROOT = process.cwd();

function readSource(relative: string): string {
  return fs.readFileSync(path.resolve(ROOT, relative), 'utf8');
}

function importSpecifiers(source: string): string[] {
  const specs: string[] = [];
  const re = /^\s*import\s+(?:type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) specs.push(match[1]);
  return specs;
}

// ── Contract unit checks ────────────────────────────────────────────────────

const VALID_INPUT = Object.freeze({
  workspaceId: 'ws-1',
  viewId: 'view-1',
  threadGroupId: 'group-1',
  threadId: 'thread-1',
  host: 'main',
});

test('descriptor input accepts durable identities only and rejects every transient/authority field', () => {
  expect(parseChatSurfaceDescriptorInput(VALID_INPUT)).toEqual({
    workspaceId: 'ws-1',
    viewId: 'view-1',
    threadGroupId: 'group-1',
    threadId: 'thread-1',
    host: 'main',
  });
  // Legacy/null view is valid.
  expect(parseChatSurfaceDescriptorInput({ ...VALID_INPUT, viewId: null })?.viewId).toBeNull();
  expect(parseChatSurfaceDescriptorInput({ ...VALID_INPUT, host: 'side-tab' })?.host).toBe('side-tab');

  const rejected: unknown[] = [
    null,
    'fusion.chat-surface',
    [],
    { ...VALID_INPUT, surfaceId: 'transient' },
    { ...VALID_INPUT, store: {} },
    { ...VALID_INPUT, socket: {} },
    { ...VALID_INPUT, onSend: () => undefined },
    { ...VALID_INPUT, path: '/Users/owner/secret' },
    { ...VALID_INPUT, element: { type: 'div' } },
    { ...VALID_INPUT, authority: 'owner' },
    { ...VALID_INPUT, extra: true },
    { workspaceId: 'ws-1', viewId: 'view-1', threadGroupId: 'group-1', threadId: 'thread-1' },
    { ...VALID_INPUT, workspaceId: '' },
    { ...VALID_INPUT, workspaceId: ' padded ' },
    { ...VALID_INPUT, threadId: 'bad\u0000control' },
    { ...VALID_INPUT, host: 'floating' },
    { ...VALID_INPUT, host: null },
  ];
  for (const candidate of rejected) {
    expect(parseChatSurfaceDescriptorInput(candidate), JSON.stringify(candidate)).toBeNull();
  }
});

test('component surfaceId derives from componentInstanceId + runtime mount generation', () => {
  const first = mintChatComponentSurfaceId('instance-abc', 1);
  const second = mintChatComponentSurfaceId('instance-abc', 2);
  const other = mintChatComponentSurfaceId('instance-def', 3);
  expect(first).toContain('instance-abc');
  expect(first).toContain(':1');
  expect(new Set([first, second, other]).size).toBe(3);
  expect(first).toMatch(/^chat-surface:component:/);
});

// ── Closed registration seam ────────────────────────────────────────────────

test('the chat registration is code-owned, CSS/DOM-free, and imports no Generic Host implementation', () => {
  const specs = importSpecifiers(readSource('src/components/chat/chatComponentRegistration.tsx'));
  for (const spec of specs) {
    expect(spec).not.toContain('componentTabConnectedAdapter');
    expect(spec).not.toContain('componentTabConnectedOwner');
    expect(spec).not.toContain('componentTabPanel');
    expect(spec).not.toContain('componentTabPlacement');
    expect(spec).not.toContain('launcher');
    expect(spec).not.toContain('captureViewTabAdapter');
    expect(spec).not.toContain('fileConnectedAdapter');
  }
  const registration = readSource('src/components/chat/chatComponentRegistration.tsx');
  expect(registration).toContain("CHAT_SURFACE_COMPONENT_TYPE");
  expect(registration).toContain('componentTypeId');
  const contract = readSource('src/components/chat/chatSurfaceRegistrationContract.ts');
  expect(contract).toContain("'workspaceId'");
  expect(contract).toContain("'viewId'");
  expect(contract).toContain("'threadGroupId'");
  expect(contract).toContain("'threadId'");
  expect(contract).toContain("'host'");
  // The transient surface id is never an allowed descriptor input key.
  expect(contract).not.toMatch(/ALLOWED_INPUT_KEYS[\s\S]{0,400}surfaceId/);
});

// ── Rendered fixture ────────────────────────────────────────────────────────

const WS = 'chat-component-workspace';
const VIEW = 'chat-component-view';
const GROUP = 'chat-component-group';
const THREAD = 'chat-component-thread';
const TAB_ID = 'chat-component-tab';
const INSTANCE_ID = 'chat-component-instance-1';

const bundles = new Map<string, Promise<string>>();

async function buildHarness(): Promise<string> {
  const existing = bundles.get('fixture');
  if (existing) return existing;
  const bundle = (async () => {
    const virtualEntry = 'virtual:chat-component-registration-harness';
    const resolvedEntry = `\0${virtualEntry}`;
    const virtualAdapters = '\0virtual:chat-component-registration-adapters';
    const viewTabBarPath = path.resolve('src/components/view-tabs/ViewTabBar.tsx');
    const registrationPath = path.resolve('src/components/chat/chatComponentRegistration.tsx');
    const resolverPath = path.resolve('src/components/view-tabs/componentTabResolver.ts');
    const panelStorePath = path.resolve('src/state/panelStore.ts');
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ViewTabBar } from ${JSON.stringify(viewTabBarPath)};
      import { chatConnectedRegistrations } from ${JSON.stringify(registrationPath)};
      import { createFirstPartyComponentResolver } from ${JSON.stringify(resolverPath)};
      import { usePanelStore } from ${JSON.stringify(panelStorePath)};

      var WS = ${JSON.stringify(WS)};
      var VIEW = ${JSON.stringify(VIEW)};
      var GROUP = ${JSON.stringify(GROUP)};
      var THREAD = ${JSON.stringify(THREAD)};
      var TAB_ID = ${JSON.stringify(TAB_ID)};
      var INSTANCE_ID = ${JSON.stringify(INSTANCE_ID)};

      var sent = [];
      var fakeWs = {
        readyState: 1,
        send: function (data) { try { sent.push(JSON.parse(data)); } catch (e) {} },
        addEventListener: function () {},
        removeEventListener: function () {},
        close: function () {},
      };

      var row = {
        threadId: THREAD,
        threadGroupId: GROUP,
        workspaceId: WS,
        viewId: VIEW,
        entry: {
          name: 'Component chat',
          createdAt: '2026-01-01T00:00:00.000Z',
          messageCount: 1,
          status: 'active',
          harnessId: 'opencode',
          harnessConfig: { model: 'm1', variant: 'high' },
        },
      };

      usePanelStore.setState({
        activeWorkspaceId: WS,
        currentThreadId: null,
        chatActive: false,
        ws: fakeWs,
        threads: [row],
        threadGroupsByWorkspaceAndView: { [WS]: { [VIEW]: [row] } },
        currentThreadGroupIdByWorkspaceAndView: {},
        legacyThreadGroupsByWorkspaceId: {},
        currentLegacyThreadGroupIdByWorkspaceId: {},
        pendingThreadOpens: [],
        projectChats: {
          [THREAD]: {
            messages: [{ id: 'u1', type: 'user', content: 'CHAT-COMPONENT-TRUTH', timestamp: 1 }],
            currentTurn: null,
            pendingTurnEnd: false,
            pendingPromptAcceptance: null,
            retryPromptDraft: null,
            pendingMessage: null,
            segments: [],
            lastReleasedSegmentCount: 0,
            activity: null,
          },
        },
        contextUsageByThread: {},
        tokenUsageByThread: {},
        wireReadyByThread: {},
        harnessSelectionByThread: {},
        viewStates: {},
      });

      var baseResolver = null;
      var disabledResolver = null;
      var unknownResolver = null;

      function descriptorFor(kind) {
        var input = {
          workspaceId: WS,
          viewId: VIEW,
          threadGroupId: GROUP,
          threadId: THREAD,
          host: 'main',
        };
        if (kind === 'invalid-tuple') input.threadId = 'not-in-population';
        if (kind === 'surface-id-input') input.surfaceId = 'transient-attack';
        if (kind === 'unknown-key') input.socket = { fake: true };
        var component = {
          schemaVersion: 1,
          componentTypeId: kind === 'unknown-type' ? 'fusion.unknown' : 'fusion.chat-surface',
          componentInstanceId: INSTANCE_ID,
          input: input,
        };
        if (kind === 'unsupported-version') component.schemaVersion = 2;
        if (kind === 'invalid-shape') component.extraField = true;
        return component;
      }

      var activeKind = 'valid';
      var sourceComponent = descriptorFor(activeKind);
      var snapshot = null;
      var listeners = new Set();
      var activationCount = 0;

      function publish() {
        snapshot = makeSnapshot();
        listeners.forEach(function (listener) { listener(); });
      }

      function makeSnapshot() {
        var active = { tabId: TAB_ID, content: { kind: 'component', revision: 1, component: sourceComponent } };
        var resolve = function (descriptor) {
          if (activeKind === 'disabled') return disabledResolver(descriptor);
          if (activeKind === 'unknown-type') return unknownResolver(descriptor);
          return baseResolver(descriptor);
        };
        return {
          panelId: 'chat-component-panel',
          label: 'Component chat tab',
          tabs: [{ id: TAB_ID, label: 'Chat surface', icon: 'chat', closeLabel: 'Close Chat surface', closable: true }],
          activeId: TAB_ID,
          tabPanelTabIndex: -1,
          onActivate: function () {},
          onClose: function () {},
          add: undefined,
          content: {
            active: active,
            reservation: null,
            resolve: resolve,
            retryLauncher: function () {},
            cancelLauncher: function () {},
          },
        };
      }

      baseResolver = createFirstPartyComponentResolver(chatConnectedRegistrations());
      disabledResolver = createFirstPartyComponentResolver(
        chatConnectedRegistrations().map(function (registration) {
          return Object.assign({}, registration, { disabled: true });
        }),
      );
      unknownResolver = createFirstPartyComponentResolver([]);

      var controller = {
        subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener); }; },
        getSnapshot: function () { return snapshot; },
        setKind: function (kind) { activeKind = kind; sourceComponent = descriptorFor(kind); publish(); },
        sentRaw: function () { return sent.slice(); },
        storeState: function () { return JSON.stringify(usePanelStore.getState()); },
        instanceId: function () { return INSTANCE_ID; },
      };
      window.__chatComponentRegistrationController = controller;
      publish();

      createRoot(document.querySelector('#root')).render(
        React.createElement(ViewTabBar, { panel: 'chat-component-panel' },
          React.createElement('div', { id: 'legacy-child' }, 'legacy')),
      );
    `;
    const adapterSource = `
      import { useSyncExternalStore } from 'react';
      export function useViewTabAdapter(panelId) {
        const controller = window.__chatComponentRegistrationController;
        const snapshot = useSyncExternalStore(
          controller.subscribe,
          controller.getSnapshot,
          controller.getSnapshot,
        );
        return panelId === 'chat-component-panel' ? snapshot : null;
      }
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      plugins: [{
        name: 'chat-component-registration-harness',
        enforce: 'pre',
        resolveId(id, importer) {
          if (id === virtualEntry) return resolvedEntry;
          if (id.includes('viewTabAdapters') && importer?.split('?')[0] === viewTabBarPath) {
            return virtualAdapters;
          }
          return null;
        },
        load(id) {
          if (id === resolvedEntry) return source;
          if (id === virtualAdapters) return adapterSource;
          return null;
        },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: {
          input: virtualEntry,
          output: { format: 'iife', name: 'ChatComponentRegistrationHarness' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Chat component registration harness did not build.');
    return chunk.code;
  })();
  bundles.set('fixture', bundle);
  return bundle;
}

async function mountFixture(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.setContent(
    '<body><section class="rv-panel active" data-panel="chat-component-panel"><div id="root"></div></section></body>',
  );
  await page.addScriptTag({ content: await buildHarness() });
  try {
    await expect(page.getByRole('tablist', { name: 'Component chat tab' })).toBeVisible();
  } catch (error) {
    if (errors.length > 0) throw new Error(errors.join('\n'));
    throw error;
  }
}

async function setKind(page: Page, kind: string): Promise<void> {
  await page.evaluate((value) => (
    window as unknown as {
      __chatComponentRegistrationController: { setKind: (k: string) => void };
    }
  ).__chatComponentRegistrationController.setKind(value), kind);
}

test('a valid fusion.chat-surface descriptor resolves ready and renders the chat surface with explicit props', async ({ page }) => {
  await mountFixture(page);
  const surface = page.locator('.rv-chat-area[data-surface-id]');
  await expect(surface).toHaveCount(1);
  const attrs = await surface.evaluate((node) => ({
    surfaceId: node.getAttribute('data-surface-id'),
    threadId: node.getAttribute('data-chat-thread-id'),
    workspaceId: node.getAttribute('data-chat-workspace-id'),
    viewId: node.getAttribute('data-chat-view-id'),
    host: node.getAttribute('data-chat-host'),
  }));
  expect(attrs.threadId).toBe(THREAD);
  expect(attrs.workspaceId).toBe(WS);
  expect(attrs.viewId).toBe(VIEW);
  expect(attrs.host).toBe('main');
  // Derived from componentInstanceId + runtime mount generation.
  expect(attrs.surfaceId).toMatch(/^chat-surface:component:chat-component-instance-1:\d+$/);
  await expect(surface.locator('.rv-chat-messages')).toContainText('CHAT-COMPONENT-TRUTH');
  await expect(page.locator('[data-chat-surface-unavailable]')).toHaveCount(0);
});

test('unknown, disabled, malformed, and unsupported descriptors stay inert under the accepted host', async ({ page }) => {
  await mountFixture(page);

  await setKind(page, 'unknown-type');
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'unknown');
  await expect(page.locator('.rv-chat-area')).toHaveCount(0);

  await setKind(page, 'disabled');
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'disabled');
  await expect(page.locator('.rv-chat-area')).toHaveCount(0);

  await setKind(page, 'unsupported-version');
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'version_unsupported');
  await expect(page.locator('.rv-chat-area')).toHaveCount(0);

  await setKind(page, 'invalid-shape');
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.locator('.rv-chat-area')).toHaveCount(0);
});

test('an invalid tuple or transient/authority input renders the inert chat body and no live mount', async ({ page }) => {
  await mountFixture(page);

  await setKind(page, 'invalid-tuple');
  await expect(page.locator('[data-chat-surface-unavailable]')).toHaveCount(1);
  await expect(page.locator('.rv-chat-area')).toHaveCount(0);

  await setKind(page, 'surface-id-input');
  await expect(page.locator('[data-chat-surface-unavailable]')).toHaveCount(1);
  await expect(page.locator('.rv-chat-area')).toHaveCount(0);

  await setKind(page, 'unknown-key');
  await expect(page.locator('[data-chat-surface-unavailable]')).toHaveCount(1);
  await expect(page.locator('.rv-chat-area')).toHaveCount(0);

  // Recovery: a valid descriptor still mounts live.
  await setKind(page, 'valid');
  await expect(page.locator('.rv-chat-area[data-surface-id]')).toHaveCount(1);
});

test('the minted component surfaceId is never persisted and never sent in an outbound frame', async ({ page }) => {
  await mountFixture(page);
  const surfaceId = await page.locator('.rv-chat-area[data-surface-id]').getAttribute('data-surface-id');
  expect(surfaceId).toBeTruthy();

  const serialized = await page.evaluate(() => (
    window as unknown as { __chatComponentRegistrationController: { storeState: () => string } }
  ).__chatComponentRegistrationController.storeState());
  expect(serialized).toContain('CHAT-COMPONENT-TRUTH');
  expect(serialized).not.toContain('chat-surface:');
  expect(serialized).not.toContain('transient-attack');

  await page.locator('.rv-chat-area textarea.rv-chat-input').fill('HELLO-COMPONENT');
  await page.locator('.rv-chat-area textarea.rv-chat-input').press('Enter');
  const frames = await page.evaluate(() => (
    window as unknown as {
      __chatComponentRegistrationController: { sentRaw: () => Array<Record<string, unknown>> };
    }
  ).__chatComponentRegistrationController.sentRaw());
  const prompt = frames.find((frame) => frame.type === 'prompt');
  expect(prompt).toBeTruthy();
  expect(prompt).toMatchObject({ type: 'prompt', threadId: THREAD });
  expect(JSON.stringify(frames)).not.toContain('surfaceId');
  expect(JSON.stringify(frames)).not.toContain(surfaceId);
});

test('built client boots the real app on the isolated server without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  await page.goto('/');
  await expect(page.locator('.rv-connection-status').first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});
