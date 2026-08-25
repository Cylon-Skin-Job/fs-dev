import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('theme picker launches from the upper-right palette button only', () => {
  const appSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/App.tsx'),
    'utf8',
  );
  const buttonSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ThemePickerButton.tsx'),
    'utf8',
  );
  const electronMainSource = fs.readFileSync(
    path.resolve(process.cwd(), 'electron/main.cjs'),
    'utf8',
  );
  const pickerCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ThemePicker.css'),
    'utf8',
  );
  const pickerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ThemePicker.tsx'),
    'utf8',
  );
  const chatAreaCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ChatArea.css'),
    'utf8',
  );
  const replyChromeCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/chat/AssistantReplyChrome.css'),
    'utf8',
  );
  const sidebarCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/Sidebar.css'),
    'utf8',
  );
  const toolsPanelCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/ToolsPanel.css'),
    'utf8',
  );
  const catalogVisualSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/catalog-visual.ts'),
    'utf8',
  );
  const appCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/App.css'),
    'utf8',
  );
  const workspaceTitleCss = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/WorkspaceTitle.css'),
    'utf8',
  );
  const panelsSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/panels.ts'),
    'utf8',
  );
  const sharedStylesSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/hooks/useSharedWorkspaceStyles.ts'),
    'utf8',
  );
  const livePreviewSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/theme/live-preview.ts'),
    'utf8',
  );
  const panelStoreSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/state/panelStore.ts'),
    'utf8',
  );

  expect(appSource).toContain("import ThemePickerButton from './ThemePickerButton';");
  expect(appSource).toContain('<ThemePickerButton />');
  expect(buttonSource).toContain('aria-label="Open theme picker"');
  expect(buttonSource).toContain('<span className="material-symbols-outlined">palette</span>');
  expect(buttonSource).toContain('onClick={() => setOpen(!open)}');
  expect(buttonSource).not.toContain("import ThemePicker from './ThemePicker'");
  expect(pickerCss).toMatch(/\.rv-theme-swatch-btn \.material-symbols-outlined\s*\{[^}]*color: var\(--chrome-accent, var\(--text-dim\)\);/s);
  expect(appCss).toMatch(/\.rv-header \.rv-fusion-icon-btn,\s*\.rv-header \.rv-theme-swatch-btn\s*\{[^}]*color: var\(--workspace-foreground-color,/s);
  expect(panelsSource).toContain("const requestId = `panel-file-${nextPanelFileRequestId}`;");
  expect(panelsSource).toContain('&& msg.requestId === requestId');
  expect(sharedStylesSource).toContain('if (generation !== themeReloadGeneration) return;');
  expect(electronMainSource).not.toContain("label: 'Theme Picker'");
  expect(electronMainSource).not.toContain("accelerator: 'CmdOrCtrl+Shift+T'");
  expect(pickerCss).toMatch(/\.rv-theme-picker-modal\s*\{[^}]*right: 0;[^}]*bottom: 0;/s);
  expect(pickerCss).toMatch(/\.rv-theme-picker-modal\s*\{[^}]*background: var\(--bg-solid, #000000\);/s);
  expect(pickerCss).not.toMatch(/\.rv-theme-picker-modal\s*\{[^}]*(?:backdrop-filter|linear-gradient)/s);
  expect(pickerCss).toContain('animation: tp-drawer-in 250ms');
  expect(pickerCss).toContain('transform: translateX(100%);');
  expect(pickerCss).toContain('transform: translateX(0);');
  expect(appSource).toContain("rv-app-container--theme-picker-open");
  expect(appCss).toMatch(/\.rv-app-container--theme-picker-open\s*\{[^}]*width: calc\(100vw - var\(--theme-picker-drawer-width\)\);/s);
  expect(pickerSource.indexOf('Light Mode')).toBeLessThan(pickerSource.indexOf('Custom Mode'));
  expect(pickerSource.indexOf('Custom Mode')).toBeLessThan(pickerSource.indexOf('Dark Mode'));
  expect(pickerSource).toContain("type PickerMode = 'light' | 'custom' | 'dark';");
  expect(pickerSource).toContain('<div className="rv-tp-group-header">Workspace Settings</div>');
  expect(pickerSource).toContain('<span className="rv-tp-color-label">Background</span>');
  expect(pickerSource).toContain('<span className="rv-tp-color-label">Theme Color</span>');
  expect(pickerSource).toContain('useState(activeTheme?.accent ?? DEFAULT_THEME_ACCENT)');
  expect(pickerSource.indexOf('>Background</span>')).toBeLessThan(pickerSource.indexOf('Workspace Settings'));
  expect(pickerSource.indexOf('>Theme Color</span>')).toBeLessThan(pickerSource.indexOf('Workspace Settings'));
  expect(pickerSource).toContain('<span className="material-symbols-outlined">wand_shine</span>');
  expect(pickerCss).toMatch(/\.rv-tp-wand-btn\s*\{[^}]*color: var\(--text-primary, #ffffff\);/s);
  expect(pickerCss).toMatch(/\.rv-tp-wand-btn \.material-symbols-outlined\s*\{[^}]*color: inherit;/s);
  expect(pickerSource).toContain("import { computeUiEmphasizedAccent } from '../../../fusion-studio-server/lib/theme/color-math.js';");
  expect(pickerSource).toContain('setThemeColorInput(computeUiEmphasizedAccent({ accent, luminance }));');
  expect(pickerSource).toContain('chatBorder, themeCode, themeColorInput);');
  expect(livePreviewSource).toContain("const secondaryAccent = /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : accent;");
  expect(livePreviewSource).toMatch(/const workspaceForegroundColor = mixHex\(\s*secondaryAccent,\s*accent,\s*clamp\(workspaceForeground\) \/ 100,/s);
  expect(livePreviewSource).toMatch(/const workspaceBorderColor = mixHex\(\s*accent,\s*secondaryAccent,\s*clamp\(workspaceBorders\) \/ 100,/s);
  expect(livePreviewSource).toMatch(/const workspaceAccentColor = mixHex\(\s*secondaryAccent,\s*accent,\s*clamp\(workspaceAccent\) \/ 100,/s);
  expect(livePreviewSource).toMatch(/const threadTextColor = computeThreadForeground\(\{\s*accent,\s*themeColor: secondaryAccent,\s*luminance,\s*threadForegroundContrast,/s);
  expect(livePreviewSource).toMatch(/const chatForegroundColor = computeChatForeground\(\{\s*accent,\s*themeColor: secondaryAccent,/s);
  expect(livePreviewSource).toContain('const threadHeadingColor = computeThreadHeadings({');
  expect(livePreviewSource).toContain('const threadForegroundColor = computeThreadPanelForeground({');
  expect(livePreviewSource).toContain('const threadAccentEntry = { accent, themeColor: secondaryAccent, luminance, threadAccent };');
  expect(livePreviewSource).toContain('const selectedThreadBackground = computeThreadAccent(threadAccentEntry);');
  expect(livePreviewSource).toContain('const selectedThreadForeground = computeThreadAccentContrast(threadAccentEntry);');
  const savedThemePayload = pickerSource.slice(
    pickerSource.indexOf('function flushPending()'),
    pickerSource.indexOf('// Live preview'),
  );
  expect(savedThemePayload).toContain('themeColor: p.themeColor');
  expect(savedThemePayload).toContain('threadHeadings: p.threadHeadings');
  expect(savedThemePayload).toContain('threadForeground: p.threadForeground');
  expect(savedThemePayload).toContain('chatBackground: p.chatBackground');
  expect(savedThemePayload).toContain('chatBubble: p.chatBubble');
  expect(savedThemePayload).toContain('contentCanvasBackground: p.contentCanvasBackground');
  expect(savedThemePayload).toContain('contentHeadings: p.contentHeadings');
  expect(savedThemePayload).toContain('contentText: p.contentText');
  expect(panelStoreSource).toMatch(
    /saveTheme: \(entry\) => \{[\s\S]*?set\(\(state\) => \{[\s\S]*?themes\[index\] = \{ \.\.\.themes\[index\], \.\.\.entry \};[\s\S]*?ws\.send\(JSON\.stringify\(\{ type: 'theme:save', theme: entry \}\)\);/s,
  );
  expect(pickerSource).toContain('label="Foreground"');
  expect(pickerSource).toContain('label="Accent"');
  expect(pickerSource).toContain('label="Borders"');
  expect(pickerSource).toContain('value={threadBackground}');
  expect(pickerSource).toContain('onChange={setThreadBackground}');
  expect(livePreviewSource).toContain('threadBackground: threadBackgroundValue');
  expect(pickerSource.indexOf('label="Accent"')).toBeLessThan(pickerSource.indexOf('label="Foreground"'));
  expect(pickerSource.indexOf('label="Foreground"')).toBeLessThan(pickerSource.indexOf('label="Borders"'));
  expect(pickerSource.indexOf('label="Borders"')).toBeLessThan(pickerSource.indexOf('Thread Settings'));
  expect(pickerSource).toContain('<div className="rv-tp-color-field">');
  expect(pickerCss).toMatch(/\.rv-tp-color-field\s*\{[^}]*width: 120px;[^}]*flex: 0 0 120px;[^}]*margin-left: auto;/s);
  expect(pickerCss).toMatch(/\.rv-tp-color-native\s*\{[^}]*position: absolute;[^}]*right: 5px;/s);
  expect(pickerSource).toContain('<div className="rv-tp-group-header">Thread Settings</div>');
  expect(pickerSource).toContain('<div className="rv-tp-group-header">Chat Settings</div>');
  const threadSettings = pickerSource.slice(
    pickerSource.indexOf('Thread Settings'),
    pickerSource.indexOf('Chat Settings'),
  );
  const chatSettings = pickerSource.slice(
    pickerSource.indexOf('Chat Settings'),
    pickerSource.indexOf('{/* ── Sliders'),
  );
  expect(threadSettings).toContain('label="Background"');
  expect(threadSettings.indexOf('label="Background"')).toBeLessThan(threadSettings.indexOf('label="Accent"'));
  expect(threadSettings.indexOf('label="Accent"')).toBeLessThan(threadSettings.indexOf('label="Foreground"'));
  expect(threadSettings.indexOf('label="Foreground"')).toBeLessThan(threadSettings.indexOf('label="Headings"'));
  expect(threadSettings.indexOf('label="Headings"')).toBeLessThan(threadSettings.indexOf('label="Text"'));
  expect(threadSettings).toContain('label="Foreground"');
  expect(threadSettings).toContain('label="Headings"');
  expect(threadSettings).toContain('label="Text"');
  expect(chatSettings).toContain('label="Foreground"');
  expect(threadSettings).toContain('label="Accent"');
  expect(chatSettings).toContain('label="Input"');
  expect(chatSettings).toContain('label="Bubble"');
  expect(chatSettings).not.toContain('label="Accent"');
  expect(chatSettings).toContain('label="Headings"');
  expect(chatSettings).toContain('label="Tools"');
  expect(chatSettings.indexOf('label="Headings"')).toBeLessThan(chatSettings.indexOf('label="Tools"'));
  expect(chatSettings.indexOf('label="Tools"')).toBeLessThan(chatSettings.indexOf('label="Text"'));
  expect(chatSettings).toContain('label="Background"');
  expect(chatSettings.indexOf('label="Background"')).toBeLessThan(chatSettings.indexOf('label="Input"'));
  expect(chatSettings.indexOf('label="Input"')).toBeLessThan(chatSettings.indexOf('label="Bubble"'));
  expect(chatSettings.indexOf('label="Bubble"')).toBeLessThan(chatSettings.indexOf('label="Foreground"'));
  expect(chatSettings).toContain('label="Text"');
  expect(pickerSource).not.toContain('Panel settings');
  expect(pickerSource).not.toContain('<SliderRow label="Luminance" value={luminance}');
  expect(pickerSource).not.toContain('<SliderRow label="Tint" value={bgTint}');
  expect(livePreviewSource).toContain('const chatSurfaceBackground = computeChatSurfaceBackground({');
  expect(livePreviewSource).toContain("root.setProperty('--chat-surface-bg', chatSurfaceBackground)");
  const contentSettings = pickerSource.slice(
    pickerSource.indexOf('Content Settings'),
    pickerSource.indexOf('Border settings'),
  );
  expect(contentSettings).toContain('label="Background"');
  expect(contentSettings).not.toContain('label="Contrast"');
  expect(contentSettings.indexOf('label="Background"')).toBeLessThan(contentSettings.indexOf('label="Headings"'));
  expect(contentSettings).toContain('label="Headings"');
  expect(contentSettings).toContain('label="Text"');
  expect(contentSettings).not.toContain('Content Contrast');
  expect(contentSettings).not.toContain('label="Luminance"');
  expect(contentSettings).not.toContain('label="Tint"');
  expect(contentSettings).not.toContain('Theme code');
  expect(pickerSource).not.toContain('label="Thread Background"');
  expect(pickerSource).not.toContain('label="Thread Foreground"');
  expect(pickerSource).not.toContain('label="Thread Accent"');
  expect(pickerSource).not.toContain('label="Chat Background"');
  expect(pickerSource).not.toContain('label="Chat Foreground"');
  expect(pickerSource).not.toContain('label="Chat Accent"');
  expect(pickerCss).toMatch(/\.rv-tp-inline-slider\s*\{[^}]*width: 120px;[^}]*margin-left: auto;/s);
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project > \.rv-chat-messages\s*\{[^}]*background: var\(--chat-surface-bg,[^}]*border-radius: 0;[^}]*margin-bottom: -24px;/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-composer-shell\s*\{[^}]*background: var\(--chat-content-bg, var\(--bg-solid, #000\)\);/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project \.rv-message-user-content\s*\{[^}]*background: var\(--chat-bubble-bg, var\(--chat-content-bg,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project > \.rv-chat-messages\s*\{[^}]*border: none;/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project \.rv-chat-composer-shell,[\s\S]*?\.rv-chat-area\.rv-chat-area--project \.rv-chat-input-wrapper:focus-within\s*\{[^}]*border: none;[^}]*box-shadow: none;/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-composer-meta-row \.rv-hover-icon-trigger\s*\{[^}]*color: var\(--chat-composer-chrome-color,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-composer-mode-trigger\s*\{[^}]*color: var\(--chat-composer-chrome-color,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-composer-model-trigger\s*\{[^}]*color: var\(--chat-composer-chrome-color,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-send-button-group\s*\{[^}]*background: var\(--theme-primary,/s,
  );
  const sendButtonRule = chatAreaCss.match(/\.rv-send-button-group\s*\{[^}]*\}/s)?.[0] ?? '';
  expect(sendButtonRule).not.toContain('--chat-accent-color');
  expect(sendButtonRule).not.toContain('--chat-composer-chrome-color');
  expect(sendButtonRule).toContain('border: none !important;');
  expect(chatAreaCss).toMatch(
    /\.rv-send-btn-main\s*\{[^}]*color: color-mix\(in srgb, var\(--chat-foreground-contrast-color,/s,
  );
  expect(chatAreaCss).not.toContain('.rv-chat-header-identity');
  expect(chatAreaCss).toMatch(/\.rv-chat-header\s*\{[^}]*border-bottom: none;/s);
  expect(chatAreaCss).toMatch(/\.rv-chat-header-right \.rv-chat-header-btn,[\s\S]*?color: var\(--chat-foreground-color,/s);
  expect(chatAreaCss).toMatch(
    /\.rv-chat-header-left-controls \.rv-chat-thread-dock,[\s\S]*?\.rv-chat-header-left-controls \.rv-chat-new-thread\[aria-expanded="true"\]\s*\{[^}]*color: var\(--chat-foreground-color,/s,
  );
  expect(sidebarCss).toMatch(
    /\.rv-sidebar \.rv-sidebar-peek-dock\s*\{[^}]*color: var\(--thread-foreground-color,/s,
  );
  expect(replyChromeCss).toMatch(/\.rv-assistant-reply-chrome\s*\{[^}]*color: var\(--chat-foreground-color,/s);
  expect(replyChromeCss).toMatch(/\.rv-assistant-reply-action\s*\{[^}]*color: var\(--chat-foreground-color,/s);
  expect(livePreviewSource).toContain("root.setProperty('--chat-tools-color', chatToolsColor)");
  expect(catalogVisualSource).toContain("iconColor: 'var(--chat-tools-color, var(--text-dim))'");
  expect(catalogVisualSource).toContain("labelColor: 'var(--chat-tools-color, var(--text-dim))'");
  expect(catalogVisualSource).toContain("contentColor: 'var(--chat-tools-color, var(--text-dim))'");
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area \.rv-message-assistant-content h1,[\s\S]*?\.rv-chat-area \.rv-code-block-header\s*\{[^}]*color: var\(--chat-accent-color,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-secondary-header-identity,[\s\S]*?\.rv-secondary-header-identity-name\s*\{[^}]*color: var\(--chat-accent-color,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project \.rv-message-assistant-content,[\s\S]*?\.rv-chat-area\.rv-chat-area--project \.rv-chat-input\s*\{[^}]*color: var\(--chat-text-color,/s,
  );
  expect(chatAreaCss).toMatch(
    /\.rv-chat-area\.rv-chat-area--project \.rv-message-user-content\s*\{[^}]*color: var\(--text-white,/s,
  );
  expect(sidebarCss).toMatch(
    /\.rv-thread-view-select\s*\{[^}]*color: var\(--thread-heading-color,/s,
  );
  expect(sidebarCss).toMatch(
    /\.rv-sidebar \.rv-new-chat-btn\s*\{[^}]*color: var\(--thread-heading-color,/s,
  );
  expect(sidebarCss).toMatch(/\.rv-sidebar \.rv-sidebar-peek-dock\s*\{[^}]*color: var\(--thread-foreground-color,/s);
  expect(sidebarCss).toMatch(/\.rv-sidebar \.rv-chat-item-text,[\s\S]*?\.rv-sidebar \.rv-chat-item-meta\s*\{[^}]*color: var\(--thread-text-color,/s);
  expect(sidebarCss).not.toContain('.rv-thread-sidebar-close');
  expect(toolsPanelCss).toMatch(
    /\.rv-tool-btn\s*\{[^}]*color: var\(--workspace-foreground-color,/s,
  );
  expect(toolsPanelCss).toMatch(
    /\.rv-tool-btn\.active\s*\{[^}]*color: var\(--workspace-accent-color,/s,
  );
  expect(toolsPanelCss).toMatch(
    /\.rv-tools-panel\s*\{[^}]*grid-column: 1 \/ 2;[^}]*border-right: 1px solid var\(--workspace-border-color,/s,
  );
  expect(toolsPanelCss).toMatch(
    /\.rv-tool-btn\.active::before\s*\{[^}]*left: 0;[^}]*border-radius: 0 2px 2px 0;/s,
  );
  expect(appCss).toMatch(
    /\.rv-app-container\s*\{[^}]*grid-template-columns: var\(--tools-width\) var\(--sidebar-width\) var\(--chat-width\) 1fr;/s,
  );
  expect(appCss).toMatch(
    /\.rv-panel-container\s*\{[^}]*grid-column: 2 \/ -1;/s,
  );
  expect(sidebarCss).toMatch(
    /\.rv-sidebar-peek-panel\s*\{[^}]*border-right: 1px solid var\(--workspace-border-color,/s,
  );
  expect(appCss).toMatch(
    /\.rv-header\s*\{[^}]*border-bottom: 1px solid var\(--workspace-border-color,/s,
  );
  expect(appCss).toMatch(
    /\.rv-resize-handle\s*\{[^}]*background: var\(--workspace-border-color,/s,
  );
  expect(appCss).toMatch(
    /\.rv-connection-status\.connected\s*\{[^}]*color: var\(--workspace-accent-color,/s,
  );
  expect(workspaceTitleCss).toMatch(
    /\.rv-workspace-name\s*\{[^}]*color: var\(--workspace-accent-color,/s,
  );
});
