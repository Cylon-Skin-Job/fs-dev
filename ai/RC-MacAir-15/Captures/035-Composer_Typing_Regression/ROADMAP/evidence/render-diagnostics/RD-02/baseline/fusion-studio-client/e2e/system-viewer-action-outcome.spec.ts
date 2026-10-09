import { expect, test } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';

const bundlePromise = buildHarness();

async function buildHarness(): Promise<string> {
  const entry = 'virtual:system-action-outcome';
  const source = `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { SystemViewer } from ${JSON.stringify(path.resolve('src/components/SystemViewer.tsx'))};
    import { useWorkspaceStore } from ${JSON.stringify(path.resolve('src/state/workspaceStore.ts'))};
    import { usePanelStore } from ${JSON.stringify(path.resolve('src/state/panelStore.ts'))};
    import { registerToastSetter } from ${JSON.stringify(path.resolve('src/lib/toast.ts'))};
    import { CHAT_ACTION_EVENT } from ${JSON.stringify(path.resolve('src/lib/chat-action.ts'))};
    const notices = [];
    const requests = [];
    let nextOutcome = 'cancelled';
    useWorkspaceStore.setState({ activeWorkspaceId: 'system-files' });
    usePanelStore.setState({ activeWorkspaceId: 'system-files', currentPanel: 'system-viewer', ws: null });
    registerToastSetter((message) => notices.push(message));
    window.addEventListener(CHAT_ACTION_EVENT, (event) => {
      const request = event.detail;
      requests.push({ target: request.target, delivery: request.delivery, promptId: request.promptId,
        workspaceId: request.capturedAddress?.workspaceId, viewId: request.capturedAddress?.viewId,
        userAborted: request.signal?.aborted });
      request.claim();
      request.complete(nextOutcome === 'failed'
        ? { status: 'failed', reason: 'invalid_action' }
        : { status: 'cancelled', address: request.capturedAddress });
    });
    createRoot(document.querySelector('#root')).render(React.createElement(SystemViewer));
    window.__systemActionOutcome = { notices, requests, setOutcome: (value) => { nextOutcome = value; } };
  `;
  const result = await build({
    configFile: false, logLevel: 'silent',
    plugins: [{ name: 'system-action-outcome', enforce: 'pre',
      resolveId(id) { return id === entry ? `\0${entry}` : null; },
      load(id) { return id === `\0${entry}` ? source : null; } }],
    build: { write: false, minify: false, rollupOptions: { input: entry, output: { format: 'iife' } } },
  });
  const chunk = result.output.find((item) => item.type === 'chunk' && item.code);
  if (!chunk?.code) throw new Error('System action outcome fixture did not build');
  return chunk.code;
}

test('System Create reports an unrequested cancellation and keeps its exact draft target available', async ({ page }) => {
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await bundlePromise });
  await page.locator('.rv-system-new-workspace').click();
  await page.getByRole('radio', { name: 'New Folder' }).check();
  await page.locator('#rv-system-new-name').fill('Early System Workspace');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__systemActionOutcome.notices.length)).toBe(1);
  expect(await page.evaluate(() => {
    const fixture = (window as any).__systemActionOutcome;
    return { notices: fixture.notices, requests: fixture.requests };
  })).toEqual({
    notices: ['Chat action unavailable; workspace request not created'],
    requests: [{ target: 'new', delivery: 'insert', promptId: 'workspace-manager.workspace-creation',
      workspaceId: 'system-files', viewId: 'system-viewer', userAborted: false }],
  });
  await expect(page.locator('.rv-system-new-overlay')).toBeVisible();
  await expect(page.locator('#rv-system-new-name')).toHaveValue('Early System Workspace');
});

test('System Create reports an exact server denial without claiming creation', async ({ page }) => {
  await page.setContent('<body><div id="root"></div></body>');
  await page.addScriptTag({ content: await bundlePromise });
  await page.evaluate(() => (window as any).__systemActionOutcome.setOutcome('failed'));
  await page.locator('.rv-system-new-workspace').click();
  await page.getByRole('radio', { name: 'New Folder' }).check();
  await page.locator('#rv-system-new-name').fill('Denied System Workspace');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__systemActionOutcome.notices.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).__systemActionOutcome.notices)).toEqual([
    'Chat action unavailable; workspace request not created',
  ]);
  await expect(page.locator('.rv-system-new-overlay')).toBeVisible();
  await expect(page.locator('#rv-system-new-name')).toHaveValue('Denied System Workspace');
});
