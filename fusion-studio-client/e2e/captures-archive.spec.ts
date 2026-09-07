import { test, expect } from '@playwright/test';

test('Captures Archive uses the flat 999-Archive grid', async ({ page }) => {
  // This production-App browser fixture has no Electron preload. Supply the
  // exact loopback descriptor Electron would expose; product code intentionally
  // has no page-origin or localhost fallback.
  await page.addInitScript(() => {
    const descriptor = Object.freeze({
      generation: 'tabsfixture000001',
      httpOrigin: `http://127.0.0.1:${window.location.port}`,
      webSocketUrl: `ws://127.0.0.1:${window.location.port}`,
    });
    const NativeWebSocket = window.WebSocket;
    class AuthenticatedFixtureWebSocket extends EventTarget {
      static readonly CONNECTING = NativeWebSocket.CONNECTING;
      static readonly OPEN = NativeWebSocket.OPEN;
      static readonly CLOSING = NativeWebSocket.CLOSING;
      static readonly CLOSED = NativeWebSocket.CLOSED;

      readonly CONNECTING = NativeWebSocket.CONNECTING;
      readonly OPEN = NativeWebSocket.OPEN;
      readonly CLOSING = NativeWebSocket.CLOSING;
      readonly CLOSED = NativeWebSocket.CLOSED;
      onopen: ((event: Event) => unknown) | null = null;
      onmessage: ((event: MessageEvent) => unknown) | null = null;
      onclose: ((event: CloseEvent) => unknown) | null = null;
      onerror: ((event: Event) => unknown) | null = null;
      private readonly nativeSocket: WebSocket;
      private authenticated = false;
      private proofSeen = false;
      private readonly bufferedMessages: MessageEvent[] = [];

      constructor(url: string | URL, protocols?: string | string[]) {
        super();
        this.nativeSocket = protocols === undefined
          ? new NativeWebSocket(url)
          : new NativeWebSocket(url, protocols);
        this.nativeSocket.addEventListener('open', () => {
          const event = new Event('open');
          this.onopen?.call(this, event);
          this.dispatchEvent(event);
          queueMicrotask(() => this.emitMessage(JSON.stringify({
            type: 'shell-auth:challenge',
            version: 1,
            connectionId: 'tabsfixtureconnection000001',
            serverNonce: 'S'.repeat(43),
            generation: descriptor.generation,
            issuedAt: Date.now(),
            expiresAt: Date.now() + 10_000,
          })));
        });
        this.nativeSocket.addEventListener('message', (event) => {
          const copy = new MessageEvent('message', { data: event.data });
          if (this.authenticated) this.emitEvent(copy, this.onmessage);
          else {
            this.bufferedMessages.push(copy);
            if (this.proofSeen && this.isFinalBootstrapFrame(event.data)) this.finishAuthentication();
          }
        });
        this.nativeSocket.addEventListener('close', (event) => {
          const copy = new CloseEvent('close', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          this.emitEvent(copy, this.onclose);
        });
        this.nativeSocket.addEventListener('error', () => {
          const event = new Event('error');
          this.emitEvent(event, this.onerror);
        });
      }

      private emitEvent<T extends Event>(event: T, handler: ((event: T) => unknown) | null) {
        handler?.call(this, event);
        this.dispatchEvent(event);
      }

      private emitMessage(data: string) {
        this.emitEvent(new MessageEvent('message', { data }), this.onmessage);
      }

      private isFinalBootstrapFrame(data: unknown) {
        if (typeof data !== 'string') return false;
        try { return JSON.parse(data)?.type === 'panel_config'; } catch { return false; }
      }

      private finishAuthentication() {
        if (this.authenticated) return;
        this.authenticated = true;
        this.emitMessage(JSON.stringify({ type: 'shell-auth:authenticated', version: 1 }));
        for (const event of this.bufferedMessages.splice(0)) {
          this.emitEvent(event, this.onmessage);
        }
      }

      get binaryType() { return this.nativeSocket.binaryType; }
      set binaryType(value) { this.nativeSocket.binaryType = value; }
      get bufferedAmount() { return this.nativeSocket.bufferedAmount; }
      get extensions() { return this.nativeSocket.extensions; }
      get protocol() { return this.nativeSocket.protocol; }
      get readyState() { return this.nativeSocket.readyState; }
      get url() { return this.nativeSocket.url; }

      close(code?: number, reason?: string) { this.nativeSocket.close(code, reason); }

      send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed?.type === 'shell-auth:proof') {
              this.proofSeen = true;
              if (this.bufferedMessages.some((event) => this.isFinalBootstrapFrame(event.data))) {
                this.finishAuthentication();
              }
              return;
            }
          } catch {
            // Forward ordinary non-JSON frames to the existing fixture server.
          }
        }
        this.nativeSocket.send(data);
      }
    }
    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      value: AuthenticatedFixtureWebSocket,
    });
    Object.defineProperty(window, 'electronAPI', {
      configurable: true,
      value: Object.freeze({
        getRuntimeDescriptor: async () => descriptor,
        onRuntimeDescriptorChanged: () => () => {},
        authorizeShellChallenge: async (challenge: Record<string, unknown>, rendererNonce: string) => ({
          type: 'shell-auth:proof',
          version: 1,
          connectionId: challenge.connectionId,
          serverNonce: challenge.serverNonce,
          rendererNonce,
          generation: challenge.generation,
          expiresAt: challenge.expiresAt,
          proof: 'P'.repeat(43),
        }),
        setWorkspaceRoot: () => {},
      }),
    });
  });
  await page.goto('/');
  await page.locator('.rv-tool-btn[title="Captures"]').click();

  const panel = page.locator('.rv-panel[data-panel="capture-viewer"].active');
  await expect(panel).toBeVisible();

  try {
    const persistedTabs = page.getByRole('tablist', { name: 'Open captures' });
    for (let attempt = 0; attempt < 64 && await persistedTabs.count() > 0; attempt += 1) {
      const closeTab = persistedTabs.getByRole('button', { name: /^Close / }).first();
      if (!await closeTab.count()) break;
      await closeTab.click();
      await page.waitForTimeout(250);
    }
    await expect(persistedTabs).toHaveCount(0);

    const openPreviewClose = page.getByRole('button', { name: /^Close .+ preview$/ });
    if (await openPreviewClose.count()) {
      await openPreviewClose.click();
    }

    const backButton = panel.getByRole('button', { name: 'Close document' });
    const gridTitle = panel.locator('.rv-capture-viewer-main-title');
    for (let attempt = 0; attempt < 3 && await gridTitle.count() === 0; attempt += 1) {
      if (await backButton.count()) {
        await backButton.click().catch(() => {});
      }
      await page.waitForTimeout(500);
    }

    await panel.getByRole('tab', { name: 'Home', exact: true }).click();
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.locator('.rv-capture-viewer-archive-grid')).toHaveCount(0);
    await expect(panel.locator('.rv-tile-row-label', { hasText: /archive/i })).toHaveCount(0);

    await panel.getByRole('button', { name: 'Search captures' }).click();
    const searchBox = panel.getByRole('searchbox', { name: 'Search captures' });
    await expect(searchBox).toBeVisible();
    await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toHaveCount(0);
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toHaveCount(0);
    await expect(panel.locator('.rv-tile-row').first()).toBeVisible({ timeout: 15000 });

    await searchBox.fill('zzzz-no-match-captures');
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Document and Artifact Capture');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toHaveCount(0);

    await searchBox.press('Enter');
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Search results');
    await expect(panel.getByLabel('Filter by type')).toBeVisible();
    await expect(panel.getByLabel('Filter by modified date')).toBeVisible();
    await expect(panel.getByLabel('Filter by location')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Title only' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Starred only' })).toBeVisible();
    await expect(panel.locator('.rv-capture-viewer-search-grid .rv-doc-tile')).toHaveCount(0);
    await expect(panel.locator('.rv-tile-row-empty')).toContainText('No matches');

    await searchBox.fill('workspace');
    await expect(panel.locator('.rv-tile-row-empty')).toContainText('No matches');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toHaveCount(0);

    await searchBox.press('Enter');
    await expect(panel.locator('.rv-capture-viewer-search-grid')).toBeVisible({ timeout: 15000 });
    const searchResultCount = await panel.locator('.rv-capture-viewer-search-grid .rv-doc-tile').count();
    expect(searchResultCount).toBeGreaterThan(0);

    await panel.getByRole('button', { name: 'Dismiss search' }).click();
    await expect(panel.getByRole('tab', { name: 'Home', exact: true })).toBeVisible();

    await panel.getByRole('tab', { name: 'Archive', exact: true }).click();
    await expect(panel.locator('.rv-capture-viewer-main-title')).toContainText('Archive');
    await expect(panel.locator('.rv-capture-viewer-archive-grid')).toBeVisible({ timeout: 15000 });
    await expect(panel.locator('.rv-tile-row')).toHaveCount(0);

    const tileCount = await panel.locator('.rv-capture-viewer-archive-grid .rv-doc-tile').count();
    expect(tileCount).toBeGreaterThan(0);
  } finally {
    if (!page.isClosed()) {
      const homeButton = panel.getByRole('tab', { name: 'Home', exact: true });
      if (await homeButton.count()) {
        await homeButton.click().catch(() => {});
      }
    }
  }
});
