import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('composer model menu is a stub beside the microphone', async ({ page }) => {
  const footerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatAreaFooter.tsx'),
    'utf8',
  );
  const menuSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/ChatComposerModelMenu.tsx'),
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

  expect(footerSource.indexOf('<ChatComposerModelMenu')).toBeLessThan(
    footerSource.indexOf('<MicTrigger'),
  );
  expect(menuSource).toContain('Deepseek V4 Flash');
  expect(menuSource).toContain('keyboard_arrow_down');
  expect(menuSource).toContain("['Provider', 'Model', 'Effort']");
  expect(menuSource).not.toContain('onSelect');

  await page.setContent(`
    <style>${dropdownCss}\n${chatAreaCss}</style>
    <div class="rv-chat-composer-actions">
      <div class="rv-chat-composer-model">
        <button class="rv-chat-composer-model-trigger" aria-label="Deepseek V4 Flash">
          <span>Deepseek V4 Flash</span>
          <span class="material-symbols-outlined">keyboard_arrow_down</span>
        </button>
        <div class="rv-dropdown rv-chat-composer-model-menu" data-open="true" role="menu" aria-label="Model configuration">
          <button class="rv-chat-composer-model-option" role="menuitem"><span>Provider</span><span class="material-symbols-outlined">chevron_right</span></button>
          <button class="rv-chat-composer-model-option" role="menuitem"><span>Model</span><span class="material-symbols-outlined">chevron_right</span></button>
          <button class="rv-chat-composer-model-option" role="menuitem"><span>Effort</span><span class="material-symbols-outlined">chevron_right</span></button>
        </div>
      </div>
      <button aria-label="Voice input">mic</button>
      <button aria-label="Send message">send</button>
    </div>
  `);

  const trigger = page.getByRole('button', { name: 'Deepseek V4 Flash', exact: true });
  const menu = page.getByRole('menu', { name: 'Model configuration', exact: true });
  await expect(trigger).toContainText('Deepseek V4 Flash');
  await expect(trigger).toContainText('keyboard_arrow_down');
  await expect(menu.getByText('Provider', { exact: true })).toBeVisible();
  await expect(menu.getByText('Model', { exact: true })).toBeVisible();
  await expect(menu.getByText('Effort', { exact: true })).toBeVisible();

  const modelBox = await trigger.boundingBox();
  const micBox = await page.getByRole('button', { name: 'Voice input', exact: true }).boundingBox();
  expect(modelBox).not.toBeNull();
  expect(micBox).not.toBeNull();
  expect(modelBox!.x + modelBox!.width).toBeLessThanOrEqual(micBox!.x);
});
