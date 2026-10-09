import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('composer screenshot menu preserves split capture and gallery controls', async ({ page }) => {
  const appSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/App.tsx'), 'utf8');
  const footerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatAreaFooter.tsx'),
    'utf8',
  );
  const addMenuSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatComposerAddMenu.tsx'),
    'utf8',
  );
  const gallerySource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/screenshots/ScreenshotsTrigger.tsx'),
    'utf8',
  );
  const clipboardSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/clipboard/ClipboardTrigger.tsx'),
    'utf8',
  );
  const editsSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/recent-files/RecentFilesTrigger.tsx'),
    'utf8',
  );
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );
  const dropdownCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/styles/dropdown.css'),
    'utf8',
  );
  const hoverModalCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/hover-icon-modal/HoverIconModal.css'),
    'utf8',
  );

  expect(appSource).toContain('void captureAndAttachScreenshot()');
  expect(appSource).toContain('onClick={handleControlCamera}');
  expect(footerSource).toContain('onAttach={handleAddAttachment}');
  expect(footerSource).toContain('onInsert={handleInsertText}');
  expect(footerSource).not.toContain('<ScreenshotsTrigger');
  expect(addMenuSource).toContain('void captureAndAttachScreenshot(screenshotOwner)');
  expect(addMenuSource).toContain('control_camera');
  expect(addMenuSource).toContain('triggerVariant="submenu"');
  expect(gallerySource).toContain("triggerVariant?: 'icon' | 'submenu'");
  expect(gallerySource).toContain('<span>Screenshots</span>');
  expect(gallerySource).toContain('chevron_right');
  expect(addMenuSource).toContain('<ClipboardTrigger onInsert={handleInsert} triggerVariant="submenu" />');
  expect(addMenuSource).toContain('<RecentFilesTrigger onInsert={handleInsert} triggerVariant="submenu" />');
  expect(clipboardSource).toContain('<span>Clipboard</span>');
  expect(clipboardSource).toContain('listPage(0, 1)');
  expect(clipboardSource).toContain('fetchEntryValue(entry.id)');
  expect(clipboardSource).toContain('handleInsertTopRanked()');
  expect(editsSource).toContain('<span>Edits</span>');
  expect(editsSource).toContain('requestRecentFiles(1)');
  expect(editsSource).toContain('onInsert?.(mostRecent.path)');

  await page.setContent(`
    <style>${dropdownCss}\n${hoverModalCss}\n${chatAreaCss}</style>
    <div class="rv-chat-composer-meta-row">
      <div class="rv-chat-composer-tools-left">
        <div class="rv-chat-composer-add">
          <button class="rv-hover-icon-trigger rv-chat-composer-add-trigger" aria-label="Add">
            <span class="material-symbols-outlined">add</span>
          </button>
          <div class="rv-dropdown rv-chat-composer-add-menu" data-open="true" role="menu">
            <div class="rv-chat-composer-menu-row rv-chat-composer-menu-row--first">
              <button class="rv-chat-composer-menu-icon-action" aria-label="Take screenshot">
                <span class="material-symbols-outlined">control_camera</span>
              </button>
              <button class="rv-chat-composer-menu-submenu" aria-label="Browse screenshots">
                <span>Screenshots</span>
                <span class="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div class="rv-chat-composer-menu-row">
              <button class="rv-chat-composer-menu-icon-action" aria-label="Insert top clipboard item">
                <span class="material-symbols-outlined">content_paste</span>
              </button>
              <button class="rv-chat-composer-menu-submenu" aria-label="Browse clipboard history">
                <span>Clipboard</span>
                <span class="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
            <div class="rv-chat-composer-menu-row rv-chat-composer-menu-row--last">
              <button class="rv-chat-composer-menu-icon-action" aria-label="Insert most recently edited file">
                <span class="material-symbols-outlined">save_clock</span>
              </button>
              <button class="rv-chat-composer-menu-submenu" aria-label="Browse recent edits">
                <span>Edits</span>
                <span class="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  const menu = page.getByRole('menu');
  const capture = page.getByRole('button', { name: 'Take screenshot', exact: true });
  const gallery = page.getByRole('button', { name: 'Browse screenshots', exact: true });
  const pasteTop = page.getByRole('button', { name: 'Insert top clipboard item', exact: true });
  const clipboard = page.getByRole('button', { name: 'Browse clipboard history', exact: true });
  const insertRecent = page.getByRole('button', { name: 'Insert most recently edited file', exact: true });
  const edits = page.getByRole('button', { name: 'Browse recent edits', exact: true });
  await expect(menu).toBeVisible();
  await expect(capture).toHaveText('control_camera');
  await expect(gallery).toContainText('Screenshots');
  await expect(pasteTop).toHaveText('content_paste');
  await expect(clipboard).toContainText('Clipboard');
  await expect(insertRecent).toHaveText('save_clock');
  await expect(edits).toContainText('Edits');

  const captureBox = await capture.boundingBox();
  const galleryBox = await gallery.boundingBox();
  expect(captureBox).not.toBeNull();
  expect(galleryBox).not.toBeNull();
  expect(captureBox!.x + captureBox!.width).toBe(galleryBox!.x);
});
