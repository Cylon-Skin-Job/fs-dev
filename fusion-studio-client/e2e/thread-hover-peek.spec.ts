import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('collapsed thread rail peeks over chat from the header dock control', async ({ page }) => {
  const headerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatAreaHeader.tsx'),
    'utf8',
  );
  const sidebarSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/Sidebar.tsx'),
    'utf8',
  );
  const threadListSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/sidebar/SidebarThreadList.tsx'),
    'utf8',
  );
  const threadJumpSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ThreadJumpDropdown.tsx'),
    'utf8',
  );
  const sidebarCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/Sidebar.css'),
    'utf8',
  );
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );

  expect(headerSource).toContain('dock_to_right');
  expect(headerSource).toContain('edit_square');
  expect(headerSource).toContain('<span className="material-symbols-outlined">event_list</span>');
  expect(headerSource).not.toContain('<span className="material-symbols-outlined">more_vert</span>');
  expect(headerSource).toContain('className="rv-chat-header-btn rv-chat-thread-dock"');
  expect(headerSource.indexOf('dock_to_right')).toBeLessThan(headerSource.indexOf('edit_square'));
  expect(headerSource).toContain('onClick={handleToggleThreads}');
  expect(headerSource).not.toContain('playlist_add');
  expect(headerSource).not.toContain('>subject</span>');
  expect(sidebarSource).toContain('<span className="material-symbols-outlined">edit_square</span>');
  expect(sidebarSource).toContain('<span>New chat</span>');
  expect(sidebarSource).toContain('<option value="active">Active Threads</option>');
  expect(sidebarSource).toContain('<option value="archive">Archive</option>');
  expect(sidebarSource).toContain('No archived threads');
  expect(sidebarSource).not.toContain('arrow_menu_close');
  expect(sidebarSource).not.toContain('rv-thread-sidebar-close');
  expect(sidebarSource).toContain("aria-label={preview ? 'Pin threads open' : 'Hide threads'}");
  expect(headerSource).toContain('{sidebarCollapsed && (');
  expect(headerSource).toContain('aria-label="Show threads"');
  expect(threadListSource).toContain('<span className="material-symbols-outlined">more_vert</span>');
  expect(threadListSource).not.toContain('rv-thread-row-icon');
  expect(threadListSource).not.toContain('resolveHarness');
  expect(threadJumpSource).not.toContain('rv-thread-row-icon');
  expect(threadJumpSource).not.toContain('resolveHarness');
  expect(threadListSource).not.toContain('                    ⋮');
  expect(sidebarSource).toContain("toggleCollapsed(panel, 'leftSidebar')");
  expect(sidebarSource.match(/<ThreadRailContents/g)).toHaveLength(2);
  expect(sidebarCss).toMatch(/\.rv-thread-view-select\s*\{[^}]*font-size: 18px;[^}]*font-weight: 700;/s);
  expect(sidebarCss).toMatch(/\.rv-thread-sidebar-header\s*\{[^}]*min-height: 47px;/s);
  expect(sidebarCss).toMatch(/\.rv-thread-view-select\s*\{[^}]*margin: 15px 0 0 7px;[^}]*text-align: left;/s);
  expect(sidebarSource).toContain('className="rv-thread-list-divider" role="separator"');
  expect(sidebarCss).toMatch(/\.rv-thread-list-divider\s*\{[^}]*background:\s*var\(--thread-foreground-color,/s);
  expect(sidebarCss).toMatch(/\.rv-sidebar \.rv-thread-menu-btn,[\s\S]*color:\s*var\(--thread-foreground-color,/s);
  expect(sidebarSource.indexOf('rv-thread-list-divider')).toBeLessThan(
    sidebarSource.indexOf('<div className="rv-thread-list">', sidebarSource.indexOf('rv-thread-list-divider')),
  );

  await page.setContent(`
    <style>
      ${sidebarCss}\n${chatAreaCss}
      .rv-panel {
        --left-sidebar-expanded-w: 220px;
        position: relative;
        display: grid;
        grid-template-columns: 0 360px;
        width: 360px;
        height: 480px;
      }
      .rv-chat-area { grid-column: 2; }
    </style>
    <div class="rv-panel">
      <aside class="rv-sidebar rv-sidebar--collapsed">
        <div class="rv-sidebar-peek-panel" aria-label="Threads">
          <div class="rv-thread-sidebar-header rv-thread-sidebar-header--preview">
            <button class="rv-chat-header-btn rv-sidebar-peek-dock" aria-label="Pin threads open">
              <span class="material-symbols-outlined">dock_to_right</span>
            </button>
            <select class="rv-thread-view-select" aria-label="Thread view">
              <option selected>Active Threads</option>
              <option>Archive</option>
            </select>
          </div>
          <button class="rv-new-chat-btn">edit_square New chat</button>
          <div class="rv-thread-list-divider" role="separator"></div>
          <div class="rv-thread-list">
            <div class="rv-chat-item">Alpha thread</div>
            <div class="rv-chat-item">Beta thread</div>
          </div>
        </div>
      </aside>
      <section class="rv-chat-area">
        <header class="rv-chat-header">
          <div class="rv-chat-header-left-controls">
            <button class="rv-chat-header-btn rv-chat-thread-dock" aria-label="Show threads">
              <span class="material-symbols-outlined">dock_to_right</span>
            </button>
          </div>
        </header>
        <div class="rv-chat-messages">Chat content</div>
      </section>
    </div>
  `);

  const dock = page.getByRole('button', { name: 'Show threads', exact: true });
  const threads = page.getByLabel('Threads', { exact: true });
  await expect(dock).toContainText('dock_to_right');
  await expect(threads).toBeHidden();

  const dockBox = await dock.boundingBox();
  expect(dockBox).not.toBeNull();
  await page.mouse.move(dockBox!.x + (dockBox!.width / 2), dockBox!.y + (dockBox!.height / 2));
  await expect(threads).toBeVisible();

  const pinDock = page.getByRole('button', { name: 'Pin threads open', exact: true });
  const threadView = page.getByLabel('Thread view', { exact: true });
  const closeDock = page.getByRole('button', { name: 'Hide threads', exact: true });
  await expect(threadView).toBeVisible();
  await expect(threadView).toHaveValue('Active Threads');
  await expect(closeDock).toHaveCount(0);
  const pinDockBox = await pinDock.boundingBox();
  expect(pinDockBox).not.toBeNull();
  await expect.poll(async () => (await pinDock.boundingBox())?.x)
    .toBeCloseTo(dockBox!.x, 1);
  expect(pinDockBox!.y).toBeCloseTo(dockBox!.y, 1);

  const chatBox = await page.locator('.rv-chat-area').boundingBox();
  const overlayBox = await threads.boundingBox();
  expect(chatBox).not.toBeNull();
  expect(overlayBox).not.toBeNull();
  await expect.poll(async () => (await threads.boundingBox())?.x)
    .toBeCloseTo(chatBox!.x, 1);
  expect(overlayBox!.y).toBeCloseTo(chatBox!.y, 1);
  expect(overlayBox!.width).toBeCloseTo(220, 1);
  expect(overlayBox!.height).toBeCloseTo(chatBox!.height, 1);

  await threads.hover();
  await expect(threads).toBeVisible();
  await page.locator('body').hover({ position: { x: 359, y: 479 } });
  await expect(threads).toBeHidden();
});
