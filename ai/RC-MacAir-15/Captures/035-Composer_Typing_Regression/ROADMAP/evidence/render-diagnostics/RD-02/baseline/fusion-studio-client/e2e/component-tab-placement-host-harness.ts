import type { Page } from '@playwright/test';
import path from 'node:path';
import { build } from 'vite';
import { placementHostOwnerSource } from './component-tab-placement-host-owner-source';
import { placementHostViewSource } from './component-tab-placement-host-view-source';

export type PlacementSource = 'Sidebar' | 'Preview' | 'Landing' | 'Empty selector';

export interface PublicPlacementRequest {
  requestId: string;
  disposition: 'current' | 'new';
  presenterId: string;
  targetKey: string;
}

let bundle: Promise<string> | null = null;

/** Builds one test-only bundle around the real placement and ViewTabBar exports. */
export function buildPlacementHostHarness(): Promise<string> {
  if (bundle) return bundle;
  bundle = (async () => {
    const virtualEntry = 'virtual:component-tab-placement-host';
    const resolvedEntry = `\0${virtualEntry}`;
    const virtualAdapters = '\0virtual:component-tab-placement-adapters';
    const viewTabBarPath = path.resolve('src/components/view-tabs/ViewTabBar.tsx');
    const source = placementHostOwnerSource(
      viewTabBarPath,
      path.resolve('src/components/view-tabs/componentTabDomain.ts'),
      path.resolve('src/components/view-tabs/componentTabResolver.ts'),
      path.resolve('src/reactRootErrorPolicy.ts'),
    ) + placementHostViewSource();
    const adapterSource = `
      import { useSyncExternalStore } from 'react';
      export function useViewTabAdapter(panelId) {
        const controller = window.__placementHost;
        const snapshot = useSyncExternalStore(
          controller.subscribe,
          controller.getSnapshot,
          controller.getSnapshot,
        );
        return panelId === 'placement-host-fixture' ? snapshot : null;
      }
    `;
    const result = await build({
      configFile: false,
      logLevel: 'silent',
      mode: 'test',
      plugins: [{
        name: 'component-tab-placement-host',
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
          output: { format: 'iife', name: 'ComponentTabPlacementHost' },
        },
      },
    }) as { output: Array<{ type: string; code?: string }> };
    const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.code);
    if (!chunk?.code) throw new Error('Component tab placement host did not build.');
    return chunk.code;
  })();
  return bundle;
}

export async function mountPlacementHost(page: Page): Promise<string[]> {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  await page.setContent(`
    <body>
      <section class="rv-panel active" data-panel="placement-host-fixture">
        <div class="rv-content-area" tabindex="-1">
          <main id="placement-root"></main>
        </div>
      </section>
    </body>
  `);
  await page.addScriptTag({ content: await buildPlacementHostHarness() });
  await page.getByRole('navigation', { name: 'Placement sources' }).waitFor();
  return pageErrors;
}
