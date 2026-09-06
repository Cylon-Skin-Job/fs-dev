import { expect, test, type Page } from '@playwright/test';
import {
  mountPlacementHost,
  type PlacementSource,
  type PublicPlacementRequest,
} from './component-tab-placement-host-harness';

type SeedName =
  | 'single-empty'
  | 'single-populated'
  | 'protected-active'
  | 'multi'
  | 'exact-inactive'
  | 'display-collision'
  | 'presenter-collision'
  | 'reserved-empty'
  | 'duplicates';

async function reset(
  page: Page,
  seed: SeedName,
  options: Record<string, unknown> = {},
) {
  await page.evaluate(({ seedName, resetOptions }) => {
    window.__placementHost.reset(seedName, resetOptions);
  }, { seedName: seed, resetOptions: options });
}

async function openFrom(
  page: Page,
  source: PlacementSource,
  request: PublicPlacementRequest,
) {
  await page.evaluate(({ sourceName, configuredRequest }) => {
    window.__placementHost.configureSource(sourceName, configuredRequest);
  }, { sourceName: source, configuredRequest: request });
  await page.getByRole('button', { name: `${source} open target` }).click();
  await expect(page.locator('[aria-label="Placement result"]'))
    .not.toHaveText('No placement result');
}

function placementRequest(
  requestId: string,
  disposition: 'current' | 'new',
  presenterId: string,
  targetKey: string,
): PublicPlacementRequest {
  return { requestId, disposition, presenterId, targetKey };
}

function summary(page: Page) {
  return page.evaluate(() => window.__placementHost.summary());
}

function evidence(page: Page) {
  return page.evaluate(() => window.__placementHost.evidence());
}

function resultPanel(page: Page) {
  return page.locator('[aria-label="Placement result"]');
}

test.beforeEach(async ({ page }) => {
  await mountPlacementHost(page);
});

test('Empty selector current fills one Empty in place with centered identity and correlated state', async ({ page }) => {
  await reset(page, 'single-empty');
  await openFrom(page, 'Empty selector', placementRequest(
    'request-fill-alpha', 'current', 'presenter.files', 'file:alpha',
  ));

  await expect(resultPanel(page)).toContainText('filled_current; tab tab-empty');
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.locator('.rv-component-tab-single-label')).toHaveText('ALPHA');
  await expect(page.getByRole('navigation', { name: 'Location: Documents > ALPHA' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ALPHA' })).toBeVisible();
  await expect(page.getByTestId('active-identity')).toHaveText(
    'Active tab tab-empty; presenter presenter.files; target file:alpha',
  );
  expect(await summary(page)).toMatchObject({
    activeTabId: 'tab-empty',
    order: ['tab-empty'],
    reservations: [],
    records: [{
      tabId: 'tab-empty',
      revision: 5,
      componentInstanceId: 'placed-instance-1',
      presenterId: 'presenter.files',
      targetKey: 'file:alpha',
      location: ['Documents', 'ALPHA'],
    }],
  });
  expect(await evidence(page)).toMatchObject({
    commits: [{ priorActiveTabId: 'tab-empty', nextActiveTabId: 'tab-empty' }],
    resolverCalls: 1,
    tabMints: 0,
    instanceMints: 1,
    routeCalls: [{ source: 'Empty selector', route: 'connected-placement-controller' }],
  });
});

test('sidebar current appends after populated content and transitions to the ordinary rail', async ({ page }) => {
  await reset(page, 'single-populated');
  await openFrom(page, 'Sidebar', placementRequest(
    'request-append-beta', 'current', 'presenter.files', 'file:beta',
  ));

  await expect(resultPanel(page)).toContainText('appended_new; tab placed-tab-1');
  await expect(page.getByRole('tablist', { name: 'Placement fixture tabs' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: 'BETA' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('navigation', { name: 'Location: Documents > BETA' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'BETA' })).toBeVisible();
  expect(await summary(page)).toMatchObject({
    activeTabId: 'placed-tab-1',
    order: ['tab-alpha', 'placed-tab-1'],
  });
  expect((await evidence(page)).commits).toHaveLength(1);
});

test('protected nested-invalid active content is preserved while current appends', async ({ page }) => {
  await reset(page, 'protected-active');
  await expect(page.getByText('This content is not available right now.')).toBeVisible();
  await openFrom(page, 'Landing', placementRequest(
    'request-protected-append', 'current', 'presenter.files', 'file:gamma',
  ));

  await expect(resultPanel(page)).toContainText('appended_new');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: 'PROTECTED' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'GAMMA' })).toBeVisible();
  const state = await summary(page);
  expect(state.order).toEqual(['tab-protected', 'placed-tab-1']);
  expect(state.records[0]).toMatchObject({
    tabId: 'tab-protected',
    targetKey: 'protected:target',
    presenterId: 'presenter.protected',
  });
  expect((await evidence(page)).commits).toHaveLength(1);
});

test('preview new appends to a multi-tab host, activates, and displays correlated location', async ({ page }) => {
  await reset(page, 'multi');
  await openFrom(page, 'Preview', placementRequest(
    'request-new-gamma', 'new', 'presenter.files', 'file:gamma',
  ));

  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('tab', { name: 'GAMMA' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('navigation', { name: 'Location: Documents > GAMMA' })).toBeVisible();
  await expect(page.getByTestId('presenter-body')).toHaveAttribute('data-target-key', 'file:gamma');
  expect(await summary(page)).toMatchObject({
    activeTabId: 'placed-tab-1',
    order: ['tab-alpha', 'tab-beta', 'placed-tab-1'],
  });
  expect((await evidence(page)).commits).toHaveLength(1);
});

test('exact existing target activates and reveals for both dispositions despite unavailable creation and body', async ({ page }) => {
  for (const disposition of ['current', 'new'] as const) {
    await reset(page, 'exact-inactive', {
      creationMode: 'unavailable',
      unavailableRenderTargets: ['file:alpha'],
    });
    await openFrom(page, 'Sidebar', placementRequest(
      `request-existing-${disposition}`, disposition, 'presenter.files', 'file:alpha',
    ));

    await expect(resultPanel(page)).toContainText(
      'activated_existing; tab tab-alpha; target presenter.files / file:alpha; reveal completed',
    );
    await expect(page.getByRole('tab')).toHaveCount(2);
    await expect(page.getByRole('tab', { name: 'ALPHA' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Component unavailable' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Location: Documents > ALPHA' })).toBeVisible();
    const proof = await evidence(page);
    expect(proof.resolverCalls).toBe(0);
    expect(proof.tabMints).toBe(0);
    expect(proof.instanceMints).toBe(0);
    expect(proof.commits).toHaveLength(1);
    expect(proof.reveals).toEqual([{
      tabId: 'tab-alpha',
      componentInstanceId: 'instance-alpha',
      presenterId: 'presenter.files',
      targetKey: 'file:alpha',
    }]);
  }
});

test('identical labels and breadcrumbs with different target identity do not deduplicate', async ({ page }) => {
  await reset(page, 'display-collision');
  await openFrom(page, 'Preview', placementRequest(
    'request-collision-b', 'current', 'presenter.files', 'collision:b',
  ));

  await expect(page.getByRole('tab', { name: 'IDENTICAL LABEL' })).toHaveCount(2);
  await expect(page.getByRole('navigation', { name: 'Location: Identical > Location' })).toBeVisible();
  expect((await summary(page)).records).toMatchObject([
    { targetKey: 'collision:a', presenterId: 'presenter.files' },
    { targetKey: 'collision:b', presenterId: 'presenter.files' },
  ]);
  expect((await evidence(page)).commits).toHaveLength(1);
});

test('the same targetKey under different presenters creates distinct tabs', async ({ page }) => {
  await reset(page, 'presenter-collision');
  await openFrom(page, 'Landing', placementRequest(
    'request-presenter-two', 'new', 'presenter.two', 'shared:resource',
  ));

  await expect(page.getByRole('tab', { name: 'SHARED RESOURCE' })).toHaveCount(2);
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByTestId('active-identity')).toContainText(
    'presenter presenter.two; target shared:resource',
  );
  expect((await summary(page)).records).toMatchObject([
    { presenterId: 'presenter.one', targetKey: 'shared:resource' },
    { presenterId: 'presenter.two', targetKey: 'shared:resource' },
  ]);
  expect((await evidence(page)).commits).toHaveLength(1);
});

test('reserved Empty current appends and preserves reservation ownership', async ({ page }) => {
  await reset(page, 'reserved-empty');
  await openFrom(page, 'Empty selector', placementRequest(
    'request-reserved-append', 'current', 'presenter.files', 'file:alpha',
  ));

  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: 'ALPHA' })).toHaveAttribute('aria-selected', 'true');
  expect(await summary(page)).toMatchObject({
    activeTabId: 'placed-tab-1',
    order: ['tab-reserved', 'placed-tab-1'],
    reservations: [{
      tabId: 'tab-reserved',
      operationId: 'operation-reserved',
      expectedRevision: 7,
      launcherId: 'fixture-launcher',
      status: 'pending',
    }],
  });
  expect((await evidence(page)).commits).toHaveLength(1);
});

test('duplicate exact targets fail closed without crashing or changing the public host', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await reset(page, 'duplicates');
  await openFrom(page, 'Sidebar', placementRequest(
    'request-ambiguous', 'current', 'presenter.files', 'file:alpha',
  ));

  await expect(page.getByRole('alert')).toHaveText(
    'Placement failed: ambiguous_existing_target; The requested target is open more than once.',
  );
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: 'ALPHA' }).first()).toHaveAttribute(
    'aria-selected', 'true',
  );
  expect(await summary(page)).toMatchObject({
    activeTabId: 'tab-duplicate-a',
    order: ['tab-duplicate-a', 'tab-duplicate-b'],
  });
  expect(await evidence(page)).toMatchObject({ commits: [], reveals: [], resolverCalls: 0 });
  expect(pageErrors).toEqual([]);
});

test('unavailable, throwing, and hostile creation resolution expose only canonical safe failure', async ({ page }) => {
  for (const mode of ['unavailable', 'throw', 'hostile']) {
    await reset(page, 'single-empty', { creationMode: mode });
    await openFrom(page, 'Preview', placementRequest(
      `request-safe-${mode}`, 'current', 'presenter.files', 'file:private',
    ));

    await expect(page.getByRole('alert')).toHaveText(
      'Placement failed: target_unavailable; The requested target is currently unavailable.',
    );
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Add content' })).toBeVisible();
    await expect(page.getByTestId('active-identity')).toContainText('Active tab tab-empty');
    expect(await summary(page)).toMatchObject({ activeTabId: 'tab-empty', order: ['tab-empty'] });
    const proof = await evidence(page);
    expect(proof.commits).toEqual([]);
    expect(proof.resolverCalls).toBe(1);
    expect(proof.hostileGetterCalls).toBe(0);
    expect(JSON.stringify(proof)).not.toContain('/Users/private');
    expect(await page.locator('body').innerText()).not.toContain('/Users/private');
    expect(await page.locator('body').innerText()).not.toContain('stack');
  }
});

test('reveal failure retains the exact activated tab and reports failure safely', async ({ page }) => {
  await reset(page, 'exact-inactive', { revealMode: 'throw' });
  await openFrom(page, 'Sidebar', placementRequest(
    'request-reveal-failure', 'new', 'presenter.files', 'file:alpha',
  ));

  await expect(resultPanel(page)).toContainText(
    'activated_existing; tab tab-alpha; target presenter.files / file:alpha; reveal failed',
  );
  await expect(page.getByRole('tab', { name: 'ALPHA' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByTestId('presenter-body')).toHaveAttribute('data-instance-id', 'instance-alpha');
  expect(await summary(page)).toMatchObject({
    activeTabId: 'tab-alpha',
    order: ['tab-alpha', 'tab-beta'],
  });
  const proof = await evidence(page);
  expect(proof.commits).toHaveLength(1);
  expect(proof.reveals).toHaveLength(1);
  expect(JSON.stringify(proof)).not.toContain('/Users/private');
});

test('mounted public-host smoke covers fill, append, dedupe activation, and safe failure', async ({ page }) => {
  await reset(page, 'single-empty');

  await openFrom(page, 'Empty selector', placementRequest(
    'smoke-fill', 'current', 'presenter.files', 'file:alpha',
  ));
  await expect(resultPanel(page)).toContainText('filled_current');
  await openFrom(page, 'Sidebar', placementRequest(
    'smoke-append', 'current', 'presenter.files', 'file:beta',
  ));
  await expect(resultPanel(page)).toContainText('appended_new');
  await openFrom(page, 'Landing', placementRequest(
    'smoke-dedupe', 'new', 'presenter.files', 'file:alpha',
  ));
  await expect(resultPanel(page)).toContainText('activated_existing');
  await page.evaluate(() => window.__placementHost.setCreationMode('throw'));
  await openFrom(page, 'Preview', placementRequest(
    'smoke-safe-failure', 'new', 'presenter.files', 'file:private',
  ));
  await expect(page.getByRole('alert')).toContainText('target_unavailable');

  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByRole('tab', { name: 'ALPHA' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('navigation', { name: 'Location: Documents > ALPHA' })).toBeVisible();
  const state = await summary(page);
  expect(state.records.filter((record: { targetKey: string | null }) => (
    record.targetKey === 'file:alpha'
  ))).toHaveLength(1);
  expect(state.order).toEqual(['tab-empty', 'placed-tab-1']);
  const proof = await evidence(page);
  expect(proof.commits).toHaveLength(3);
  expect(proof.commits.map((commit: { requestId: string }) => commit.requestId)).toEqual([
    'smoke-fill',
    'smoke-append',
    'smoke-dedupe',
  ]);
  expect(proof.reveals).toEqual([{
    tabId: 'tab-empty',
    componentInstanceId: 'placed-instance-1',
    presenterId: 'presenter.files',
    targetKey: 'file:alpha',
  }]);
  expect(proof.routeCalls).toEqual([
    { source: 'Empty selector', route: 'connected-placement-controller' },
    { source: 'Sidebar', route: 'connected-placement-controller' },
    { source: 'Landing', route: 'connected-placement-controller' },
    { source: 'Preview', route: 'connected-placement-controller' },
  ]);
  expect(proof.results.map((item: { ok: boolean; code?: string; outcome?: string }) => (
    item.ok ? item.outcome : item.code
  ))).toEqual(['filled_current', 'appended_new', 'activated_existing', 'target_unavailable']);
});

declare global {
  interface Window {
    __placementHost: {
      reset: (seed?: SeedName, options?: Record<string, unknown>) => void;
      configureSource: (source: PlacementSource, request: PublicPlacementRequest) => void;
      state: () => unknown;
      summary: () => {
        activeTabId: string;
        order: string[];
        reservations: unknown[];
        records: Array<Record<string, unknown>>;
      };
      evidence: () => {
        commits: unknown[];
        reveals: unknown[];
        resolverCalls: number;
        tabMints: number;
        instanceMints: number;
        hostileGetterCalls: number;
        routeCalls: Array<{ source: PlacementSource; route: string }>;
        results: Array<{ ok: boolean; code?: string; outcome?: string }>;
      };
      setCreationMode: (mode: string) => void;
      setRevealMode: (mode: string) => void;
    };
  }
}
