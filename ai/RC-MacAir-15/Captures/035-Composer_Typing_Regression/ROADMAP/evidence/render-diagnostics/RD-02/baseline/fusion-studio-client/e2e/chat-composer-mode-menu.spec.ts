import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('composer mode menu sits beside Add and presents all permission choices', async ({ page }) => {
  const footerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatAreaFooter.tsx'),
    'utf8',
  );
  const modeSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatComposerModeMenu.tsx'),
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

  expect(footerSource.indexOf('<ChatComposerAddMenu')).toBeLessThan(
    footerSource.indexOf('<ChatComposerModeMenu'),
  );
  expect(modeSource).toContain("icon: 'shield_lock'");
  expect(modeSource).toContain("icon: 'arming_countdown'");
  expect(modeSource).toContain("icon: 'gpp_maybe'");
  expect(modeSource).toContain("icon: 'shield_toggle'");
  expect(modeSource).toContain("label: 'Ask Permission'");
  expect(modeSource).toContain("label: 'Auto Run'");
  expect(modeSource).toContain("label: 'Disk Access'");
  expect(modeSource).toContain("label: 'Set Custom Config'");
  expect(modeSource).not.toContain('localStorage');
  expect(modeSource).not.toContain('handleSelect');

  await page.setContent(`
    <style>${dropdownCss}\n${chatAreaCss}</style>
    <div class="rv-chat-area" style="width: 520px">
      <div class="rv-chat-composer-meta-row">
        <div class="rv-chat-composer-tools-left">
          <button class="rv-hover-icon-trigger" aria-label="Add">add</button>
          <div class="rv-chat-composer-mode">
            <button class="rv-chat-composer-mode-trigger" aria-label="Mode">
              <span class="material-symbols-outlined">shield_lock</span>
              <span class="rv-chat-composer-mode-label">Mode</span>
            </button>
            <div class="rv-dropdown rv-chat-composer-mode-menu" data-open="true" role="menu" aria-label="Permission mode">
            <button class="rv-chat-composer-mode-option" role="menuitem">
              <span class="material-symbols-outlined rv-chat-composer-mode-option-icon">shield_lock</span>
              <span class="rv-chat-composer-mode-option-copy"><span class="rv-chat-composer-mode-option-label">Ask Permission</span><span class="rv-chat-composer-mode-option-description">Always ask to edit files, access the internet, and run commands.</span></span>
            </button>
            <button class="rv-chat-composer-mode-option" role="menuitem">
              <span class="material-symbols-outlined rv-chat-composer-mode-option-icon">arming_countdown</span>
              <span class="rv-chat-composer-mode-option-copy"><span class="rv-chat-composer-mode-option-label">Auto Run</span><span class="rv-chat-composer-mode-option-description">Run continuously with workspace-wide permissions.</span></span>
            </button>
            <button class="rv-chat-composer-mode-option" role="menuitem">
              <span class="material-symbols-outlined rv-chat-composer-mode-option-icon">gpp_maybe</span>
              <span class="rv-chat-composer-mode-option-copy"><span class="rv-chat-composer-mode-option-label">Disk Access</span><span class="rv-chat-composer-mode-option-description">Unrestricted access to the internet and any file on your computer.</span></span>
            </button>
            <button class="rv-chat-composer-mode-option" role="menuitem">
              <span class="material-symbols-outlined rv-chat-composer-mode-option-icon">shield_toggle</span>
              <span class="rv-chat-composer-mode-option-copy"><span class="rv-chat-composer-mode-option-label">Set Custom Config</span></span>
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  const add = page.getByRole('button', { name: 'Add', exact: true });
  const trigger = page.getByRole('button', { name: 'Mode', exact: true });
  const menu = page.getByRole('menu', { name: 'Permission mode', exact: true });
  await expect(trigger).toContainText('shield_lock');
  await expect(trigger).toContainText('Mode');
  await expect(menu).toBeVisible();
  await expect(menu.getByText('Ask Permission', { exact: true })).toBeVisible();
  await expect(menu.getByText('Always ask to edit files, access the internet, and run commands.', { exact: true })).toBeVisible();
  await expect(menu.getByText('Auto Run', { exact: true })).toBeVisible();
  await expect(menu.getByText('Run continuously with workspace-wide permissions.', { exact: true })).toBeVisible();
  await expect(menu.getByText('Disk Access', { exact: true })).toBeVisible();
  await expect(menu.getByText('Unrestricted access to the internet and any file on your computer.', { exact: true })).toBeVisible();
  await expect(menu.getByText('Set Custom Config', { exact: true })).toBeVisible();

  const addBox = await add.boundingBox();
  const modeBox = await trigger.boundingBox();
  expect(addBox).not.toBeNull();
  expect(modeBox).not.toBeNull();
  expect(modeBox!.x).toBeGreaterThan(addBox!.x + addBox!.width);

  const modeLabel = page.locator('.rv-chat-composer-mode-label');
  await expect(modeLabel).toBeVisible();
  await page.locator('.rv-chat-area').evaluate((element) => {
    (element as HTMLElement).style.width = '480px';
  });
  await expect(modeLabel).toBeHidden();
});
