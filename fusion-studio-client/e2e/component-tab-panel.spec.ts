import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';
import {
  createFirstPartyComponentResolver,
  type FirstPartyComponentRegistration,
  normalizeComponentResolution,
} from '../src/components/view-tabs/componentTabResolver';

let harnessBundle: Promise<string> | null = null;

async function buildHarness() {
  if (harnessBundle) return harnessBundle;
  harnessBundle = (async () => {
    const virtualId = 'virtual:component-tab-panel-harness';
    const resolvedId = `\0${virtualId}`;
    const panelPath = path.resolve('src/components/view-tabs/ComponentTabPanel.tsx');
    const rootErrorPolicyPath = path.resolve('src/reactRootErrorPolicy.ts');
    const source = `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { ComponentTabPanel } from ${JSON.stringify(panelPath)};
      import { reactRootErrorOptions } from ${JSON.stringify(rootErrorPolicyPath)};
      import { createFirstPartyComponentResolver } from ${JSON.stringify(
        path.resolve('src/components/view-tabs/componentTabResolver.ts'),
      )};

      const evidence = { retries: [], cancellations: [], actions: [], renders: [] };
      const readyRegistration = {
        componentTypeId: 'fixture.card',
        label: 'Fixture card',
        render: ({ descriptor, input, actions }) => {
          evidence.renders.push({ descriptor, input });
          return React.createElement('button', {
            type: 'button',
            onClick: () => actions.activate(),
          }, 'Run ' + input.title);
        },
      };
      const disabledRegistration = {
        ...readyRegistration,
        label: 'Disabled fixture',
        disabled: true,
      };
      function ThrowingPresenter() {
        throw new Error('PRIVATE /Users/owner/secret-presenter.tsx stack');
      }
      class ThrowingLifecyclePresenter extends React.Component {
        componentDidMount() {
          throw new Error('PRIVATE /Users/owner/secret-lifecycle.tsx stack');
        }

        render() {
          return React.createElement('div', null, 'Transient lifecycle presenter');
        }
      }
      const throwingRegistration = {
        ...readyRegistration,
        render: () => React.createElement(ThrowingPresenter),
      };
      const lifecycleThrowingRegistration = {
        ...readyRegistration,
        render: () => React.createElement(ThrowingLifecyclePresenter),
      };
      const actions = { activate: () => evidence.actions.push('activated') };
      const readyResolver = createFirstPartyComponentResolver([readyRegistration], actions);
      const disabledResolver = createFirstPartyComponentResolver([disabledRegistration], actions);
      const throwingResolver = createFirstPartyComponentResolver([throwingRegistration], actions);
      const lifecycleThrowingResolver = createFirstPartyComponentResolver([lifecycleThrowingRegistration], actions);
      const empty = { tabId: 'tab-fixture', content: { kind: 'empty', revision: 0 } };
      const descriptor = {
        schemaVersion: 1,
        componentTypeId: 'fixture.card',
        componentInstanceId: 'instance-fixture',
        input: { title: 'Fixture title', count: 2 },
        targetKey: 'fixture:target',
      };
      const component = { tabId: 'tab-fixture', content: { kind: 'component', revision: 1, component: descriptor } };
      // VIEW-02 §6: the launcher grid is retired. The Empty surface renders an
      // optional view-supplied body (bounded) or the neutral fallback.
      const emptyBody = () => React.createElement(
        'div',
        { 'data-fixture-empty-body': 'true' },
        React.createElement('button', {
          type: 'button',
          className: 'rv-empty-tab-fixture-body-button',
          onClick: () => evidence.actions.push('body'),
        }, 'Fixture empty body'),
      );
      const throwingBody = () => React.createElement(ThrowingPresenter);
      let root = createRoot(document.querySelector('#consumer-root'), reactRootErrorOptions);

      function model(mode) {
        if (mode === 'empty') return { active: empty, reservation: null, resolve: readyResolver };
        if (mode === 'empty-body') return {
          active: empty,
          reservation: null,
          resolve: readyResolver,
          renderEmptyBody: emptyBody,
        };
        if (mode === 'empty-body-throwing') return {
          active: empty,
          reservation: null,
          resolve: readyResolver,
          renderEmptyBody: throwingBody,
        };
        if (mode === 'pending') return {
          active: empty,
          reservation: {
            tabId: 'tab-fixture', operationId: 'operation-pending', expectedRevision: 0,
            launcherId: 'first', status: 'pending',
          },
          reservationLabel: 'First item',
          resolve: readyResolver,
        };
        if (mode === 'failed') return {
          active: empty,
          reservation: {
            tabId: 'tab-fixture', operationId: 'operation-failed', expectedRevision: 0,
            launcherId: 'third', status: 'failed',
            error: { code: 'launch_failed', message: 'The content could not be opened. Try again.' },
          },
          reservationLabel: 'Third item',
          resolve: readyResolver,
        };
        if (mode === 'unknown') return {
          active: { ...component, content: { ...component.content, component: { ...descriptor, componentTypeId: 'fixture.unknown' } } },
          reservation: null,
          resolve: readyResolver,
        };
        if (mode === 'disabled') return { active: component, reservation: null, resolve: disabledResolver };
        if (mode === 'throwing') return { active: component, reservation: null, resolve: throwingResolver };
        if (mode === 'lifecycle-throwing') return {
          active: {
            ...component,
            content: {
              ...component.content,
              revision: 2,
              component: { ...descriptor, componentInstanceId: 'instance-lifecycle' },
            },
          },
          reservation: null,
          resolve: lifecycleThrowingResolver,
        };
        if (mode === 'recovered') return {
          active: {
            ...component,
            content: {
              ...component.content,
              revision: 3,
              component: {
                ...descriptor,
                componentInstanceId: 'instance-recovered',
                input: { title: 'Recovered presenter', count: 3 },
              },
            },
          },
          reservation: null,
          resolve: readyResolver,
        };
        if (mode === 'unsupported') return {
          active: { ...component, content: { ...component.content, component: { ...descriptor, schemaVersion: 2 } } },
          reservation: null,
          resolve: readyResolver,
        };
        if (mode === 'invalid') return {
          active: { ...component, content: { ...component.content, component: { ...descriptor, callback: () => {} } } },
          reservation: null,
          resolve: readyResolver,
        };
        return { active: component, reservation: null, resolve: readyResolver };
      }

      function render(mode) {
        const current = model(mode);
        root.render(React.createElement(ComponentTabPanel, {
          ...current,
          onRetryLauncher: (tabId) => evidence.retries.push(tabId),
          onCancelLauncher: (tabId) => evidence.cancellations.push(tabId),
        }));
      }

      window.__componentTabHarness = {
        mount: render,
        set: render,
        throwUncaught: () => root.render(React.createElement(ThrowingPresenter)),
        evidence: () => JSON.parse(JSON.stringify(evidence)),
      };
    `;
    const result = await build({
      configFile: false,
      mode: 'production',
      logLevel: 'silent',
      plugins: [{
        name: 'component-tab-panel-harness',
        resolveId(id) { return id === virtualId ? resolvedId : null; },
        load(id) { return id === resolvedId ? source : null; },
      }],
      build: {
        write: false,
        minify: false,
        rollupOptions: { input: virtualId, output: { format: 'iife', name: 'ComponentTabHarness' } },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Component tab panel harness did not build.');
    return chunk.code;
  })();
  return harnessBundle;
}

async function mount(page: Page, mode: string) {
  await page.setContent('<button id="outside">Outside</button><div id="outside-surface">Outside surface</div><div id="consumer-root"></div>');
  await page.addScriptTag({ content: await buildHarness() });
  await page.evaluate((value) => window.__componentTabHarness.mount(value), mode);
}

test('first-party resolver validates before allowlisted execution and fails closed', () => {
  let executions = 0;
  const registration: FirstPartyComponentRegistration = {
    componentTypeId: 'fixture.card',
    label: 'Fixture card',
    render: ({ descriptor, input, actions }) => {
      executions += 1;
      expect(descriptor.componentInstanceId).toBe('instance-a');
      expect(input).toEqual({ title: 'Fixture' });
      expect(actions.activate).toBeDefined();
      return null;
    },
  };
  const resolver = createFirstPartyComponentResolver([registration], { activate: () => undefined });
  const valid = {
    schemaVersion: 1,
    componentTypeId: 'fixture.card',
    componentInstanceId: 'instance-a',
    input: { title: 'Fixture' },
  };
  const ready = resolver(valid);
  expect(ready.status).toBe('ready');
  expect(executions).toBe(0);
  if (ready.status === 'ready') ready.render();
  expect(executions).toBe(1);

  const candidates = [
    { value: { ...valid, componentTypeId: 'fixture.unknown' }, code: 'unknown' },
    { value: { ...valid, schemaVersion: 2 }, code: 'version_unsupported' },
    { value: { ...valid, callback: () => undefined }, code: 'invalid' },
  ];
  for (const candidate of candidates) {
    const before = { ...candidate.value };
    expect(resolver(candidate.value)).toMatchObject({ status: 'unavailable', code: candidate.code });
    expect(candidate.value).toEqual(before);
  }
  expect(executions).toBe(1);

  const disabled = createFirstPartyComponentResolver([{ ...registration, disabled: true }]);
  expect(disabled(valid)).toMatchObject({
    status: 'unavailable',
    code: 'disabled',
    label: 'Fixture card',
  });
  expect(executions).toBe(1);
});

test('resolver projections require exact bounded data properties before render execution', () => {
  const render = () => null;
  expect(normalizeComponentResolution({ status: 'ready', key: 'fixture:key', render })).toEqual({
    status: 'ready',
    key: 'fixture:key',
    render,
  });
  expect(normalizeComponentResolution({
    status: 'unavailable',
    code: 'unknown',
    label: 'Component unavailable',
  })).toEqual({
    status: 'unavailable',
    code: 'unknown',
    label: 'Component unavailable',
  });

  const accessor = { status: 'ready', key: 'fixture:key' } as Record<string, unknown>;
  Object.defineProperty(accessor, 'render', { enumerable: true, get: () => render });
  const symbol = { status: 'ready', key: 'fixture:key', render } as Record<PropertyKey, unknown>;
  symbol[Symbol('extra')] = true;
  for (const candidate of [
    null,
    { status: 'ready', key: 'fixture:key', render: 7 },
    { status: 'ready', key: 'fixture:key', render, extra: true },
    { status: 'ready', key: 'x'.repeat(514), render },
    { status: 'unavailable', code: 'install', label: 'Install it' },
    { status: 'unavailable', code: 'unknown', label: 'x'.repeat(513) },
    { status: 'unavailable', code: 'unknown' },
    accessor,
    symbol,
  ]) {
    expect(normalizeComponentResolution(candidate)).toBeNull();
  }
});

test('empty presentation presents no menu; the view body renders bounded with a neutral fallback', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  // No view-supplied body: the minimal neutral surface, no menu, no buttons.
  await mount(page, 'empty');
  await expect(page.getByRole('heading', { name: 'Add content' })).toHaveCount(0);
  await expect(page.locator('.rv-empty-tab-launcher')).toHaveCount(0);
  await expect(page.locator('.rv-empty-tab-panel')).toBeVisible();
  await expect(page.locator('.rv-empty-tab-neutral')).toBeVisible();
  await expect(page.locator('.rv-empty-tab-panel').getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.getByRole('tabpanel')).toHaveCount(0);

  // A view-supplied Empty-body presenter renders inside the generic surface.
  await page.evaluate(() => window.__componentTabHarness.set('empty-body'));
  await expect(page.locator('[data-fixture-empty-body]')).toBeVisible();
  await page.locator('.rv-empty-tab-fixture-body-button').click();
  await expect.poll(() => page.evaluate(() => window.__componentTabHarness.evidence().actions))
    .toEqual(['body']);

  // A body presenter whose render throws is error-bounded to the neutral
  // surface (private stacks never surface).
  await page.evaluate(() => window.__componentTabHarness.set('empty-body-throwing'));
  await expect(page.locator('.rv-empty-tab-neutral')).toBeVisible();
  await expect(page.locator('[data-fixture-empty-body]')).toHaveCount(0);
  await expect(page.getByText(/PRIVATE|secret-presenter/i)).toHaveCount(0);
  expect(consoleErrors).toEqual(['[Fusion Studio] A component error was contained.']);
});

test('pending and failed reservations expose only deterministic safe controls', async ({ page }) => {
  await mount(page, 'pending');
  await expect(page.locator('.rv-empty-tab-panel')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('status')).toContainText('Opening First item');
  await expect(page.getByRole('button', { name: /Retry/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.evaluate(() => window.__componentTabHarness.set('failed'));
  await expect(page.getByRole('alert')).toHaveText('The content could not be opened. Try again.');
  await page.getByRole('button', { name: 'Retry Third item' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect.poll(() => page.evaluate(() => window.__componentTabHarness.evidence())).toMatchObject({
    retries: ['tab-fixture'],
    cancellations: ['tab-fixture', 'tab-fixture'],
  });
});

test('ready projection receives validated input and actions while unavailable states stay inert', async ({ page }) => {
  await mount(page, 'ready');
  await page.getByRole('button', { name: 'Run Fixture title' }).click();
  await expect.poll(() => page.evaluate(() => window.__componentTabHarness.evidence())).toMatchObject({
    actions: ['activated'],
    renders: [{
      descriptor: {
        schemaVersion: 1,
        componentTypeId: 'fixture.card',
        componentInstanceId: 'instance-fixture',
        input: { title: 'Fixture title', count: 2 },
        targetKey: 'fixture:target',
      },
      input: { title: 'Fixture title', count: 2 },
    }],
  });

  for (const [mode, code] of [
    ['unknown', 'unknown'],
    ['disabled', 'disabled'],
    ['unsupported', 'version_unsupported'],
    ['invalid', 'invalid'],
  ]) {
    await page.evaluate((value) => window.__componentTabHarness.set(value), mode);
    const unavailable = page.locator('.rv-component-tab-unavailable');
    await expect(unavailable).toHaveAttribute('data-unavailable-code', code);
    await expect(page.getByRole('button', { name: /Run Fixture/ })).toHaveCount(0);
    await expect(page.locator('.rv-component-tab-panel')).toHaveAttribute('data-tab-id', 'tab-fixture');
  }
  await expect.poll(() => page.evaluate(
    () => window.__componentTabHarness.evidence().renders.length,
  )).toBe(1);

  await page.evaluate(() => window.__componentTabHarness.set('disabled'));
  await expect(page.getByRole('heading', { name: 'Disabled fixture' })).toBeVisible();
  await page.evaluate(() => window.__componentTabHarness.set('ready'));
  await expect(page.getByRole('button', { name: 'Run Fixture title' })).toBeVisible();
});

test('descendant render and lifecycle errors stay inside the body and reset for new body identity', async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await mount(page, 'throwing');
  const unavailable = page.locator('.rv-component-tab-unavailable');
  await expect(unavailable).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(unavailable).toHaveText(/Component unavailable/);
  await expect(page.getByText('PRIVATE /Users/owner/secret-presenter.tsx stack')).toHaveCount(0);
  await expect(page.locator('#consumer-root')).toBeVisible();
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual(['[Fusion Studio] A component error was contained.']);

  await page.evaluate(() => window.__componentTabHarness.set('lifecycle-throwing'));
  await expect(unavailable).toHaveAttribute('data-unavailable-code', 'invalid');
  await expect(page.getByText('Transient lifecycle presenter')).toHaveCount(0);
  await expect(page.getByText('PRIVATE /Users/owner/secret-lifecycle.tsx stack')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([
    '[Fusion Studio] A component error was contained.',
    '[Fusion Studio] A component error was contained.',
  ]);
  expect(consoleErrors.join('\n')).not.toMatch(/PRIVATE|\/Users\/owner|secret-|stack/i);

  await page.evaluate(() => window.__componentTabHarness.set('recovered'));
  await expect(page.getByRole('button', { name: 'Run Recovered presenter' })).toBeVisible();
  await expect(page.locator('.rv-component-tab-unavailable')).toHaveCount(0);

  await page.evaluate(() => window.__componentTabHarness.throwUncaught());
  await expect.poll(() => pageErrors).toEqual([
    'PRIVATE /Users/owner/secret-presenter.tsx stack',
  ]);
});

test('replacement preserves focus only when focus was inside the empty panel', async ({ page }) => {
  await mount(page, 'empty-body');
  await page.locator('.rv-empty-tab-fixture-body-button').focus();
  await page.evaluate(() => window.__componentTabHarness.set('ready'));
  await expect(page.locator('.rv-component-tab-panel')).toBeFocused();

  await page.evaluate(() => window.__componentTabHarness.set('empty-body'));
  await page.locator('#outside').focus();
  await page.evaluate(() => window.__componentTabHarness.set('ready'));
  await expect(page.locator('#outside')).toBeFocused();

  await page.evaluate(() => window.__componentTabHarness.set('empty-body'));
  await page.locator('.rv-empty-tab-fixture-body-button').focus();
  await page.locator('#outside-surface').click();
  await expect(page.locator('body')).toBeFocused();
  await page.evaluate(() => window.__componentTabHarness.set('ready'));
  await expect(page.locator('body')).toBeFocused();
});

test('portable source dependencies and styles remain within the approved boundary', () => {
  const read = (relativePath: string) => fs.readFileSync(path.resolve(relativePath), 'utf8');
  const portable = [
    read('src/components/view-tabs/ComponentTabPanel.tsx'),
    read('src/components/view-tabs/EmptyTabPanel.tsx'),
    read('src/components/view-tabs/PresenterErrorBoundary.tsx'),
  ].join('\n');
  const resolver = read('src/components/view-tabs/componentTabResolver.ts');
  const css = read('src/components/view-tabs/componentTabPanel.css');
  const main = read('src/main.tsx');
  const rootErrorPolicy = read('src/reactRootErrorPolicy.ts');
  expect(portable).not.toMatch(/zustand|Store|Controller|Service|WebSocket|filesystem|plugin/i);
  expect(portable).not.toMatch(/src\/(state|lib\/ws|services|controllers|plugins)/);
  expect(resolver).not.toMatch(/import\s*\(|eval\s*\(|filesystem|plugin|viewConfig/i);
  expect(main).toContain("createRoot(document.getElementById('root')!, reactRootErrorOptions)");
  expect(rootErrorPolicy).toContain('onCaughtError');
  expect(rootErrorPolicy).not.toMatch(/onUncaughtError|onRecoverableError|componentStack|errorInfo/);
  expect(css.match(/\.[a-z][\w-]*/g) ?? []).toEqual(expect.arrayContaining([
    '.rv-component-tab-panel',
    '.rv-empty-tab-panel',
  ]));
  for (const className of css.match(/\.[a-z][\w-]*/g) ?? []) {
    expect(className).toMatch(/^\.(rv-component-tab-|rv-empty-tab-)/);
  }
  expect(css).not.toMatch(/style=/);
});

declare global {
  interface Window {
    __componentTabHarness: {
      mount: (mode: string) => void;
      set: (mode: string) => void;
      throwUncaught: () => void;
      evidence: () => {
        retries: string[];
        cancellations: string[];
        actions: string[];
        renders: Array<Record<string, unknown>>;
      };
    };
  }
}
