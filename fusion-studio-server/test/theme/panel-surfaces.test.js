const { computePanelSurfaces, computeUiEmphasizedAccent, computeWorkspaceForeground, computeWorkspaceBorders, computeWorkspaceAccent, computeThreadBackground, computeChatSurfaceBackground, computeThreadForeground, computeThreadHeadings, computeThreadPanelForeground, computeThreadAccent, computeThreadAccentContrast, computeChatBackground, computeChatBubbleBackground, computeChatComposerChrome, computeChatForeground, computeChatForegroundContrast, computeChatAccent, computeChatTools, computeChatText, computeContentCanvasBackground, computeContentBackground, computeContentAccent, computeContentAccentContrast, computeContentForeground, computeContentHeadings, computeContentText, applyContentTextTone, computeContentSurfaces, computeContentEmphasized, computeContentAttenuated } = require('../../lib/theme/color-math');
const panelCss = require('../../lib/theme/panel-css');
const syntaxCss = require('../../lib/theme/syntax-css');
const workspaceCss = require('../../lib/theme/workspace-css');
const themeCssGenerator = require('../../lib/theme/theme-css-generator');

describe('panel surface color derivation', () => {
  const entry = {
    accent: '#80270a',
    luminance: 0,
    bgTint: 30,
  };

  test('uses the selected color exactly when background contrast is zero', () => {
    const zeroContrast = { ...entry, panelContrast: 0 };

    expect(computePanelSurfaces(zeroContrast)).toEqual({
      floor: '#80270a',
      surf: '#80270a',
      codeBg: '#80270a',
      panelBg: '#80270a',
    });
    expect(panelCss.render(zeroContrast)).toContain('--bg-primary:            #80270a;');
    expect(workspaceCss.render(zeroContrast)).toContain('color-mix(in srgb, #80270a 92%, #80270a 8%)');
  });

  test('preserves the established luminance/tint result at midpoint contrast', () => {
    expect(computePanelSurfaces({ ...entry, panelContrast: 50 }).floor).toBe('#260c03');
  });

  test('derives the wand color with the shared OKLCH emphasis heuristic', () => {
    expect(computeUiEmphasizedAccent({ accent: '#242235', luminance: 0 })).toBe('#6d6b80');
    expect(computeUiEmphasizedAccent({ accent: '#000000', luminance: 0 })).toBe('#ffffff');
    expect(computeUiEmphasizedAccent({ accent: '#ffffff', luminance: 100 })).toBe('#000000');
  });

  test('ranges the thread surface from Background to a 10% mode-pole blend', () => {
    expect(computeThreadBackground({ accent: entry.accent, luminance: 0, threadBackground: 0 }))
      .toBe('#80270a');
    expect(computeThreadBackground({ accent: entry.accent, luminance: 0, threadBackground: 100 }))
      .toBe('#8d3d23');
    expect(computeThreadBackground({ accent: entry.accent, luminance: 100, threadBackground: 100 }))
      .toBe('#732309');
    expect(computeThreadBackground({ accent: entry.accent }))
      .toBe('#863216');
    expect(computeChatSurfaceBackground({ accent: entry.accent, luminance: 0, chatBackground: 0 }))
      .toBe('#80270a');
    expect(computeChatSurfaceBackground({ accent: entry.accent, luminance: 0, chatBackground: 100 }))
      .toBe('#8d3d23');
    expect(computeChatSurfaceBackground({ accent: entry.accent, luminance: 100, chatBackground: 100 }))
      .toBe('#732309');
    expect(computeThreadForeground({ accent: entry.accent, themeColor: '#42678a', luminance: 0 }))
      .toBe('#557696');
    expect(computeThreadForeground({ accent: entry.accent, themeColor: '#42678a', luminance: 100 }))
      .toBe('#3b5d7c');
    expect(computeThreadForeground({ accent: entry.accent, themeColor: '#42678a', luminance: 0, threadForegroundContrast: 50 }))
      .toBe('#6b4f50');
    expect(computeThreadForeground({ accent: entry.accent, themeColor: '#42678a', luminance: 0, threadForegroundContrast: 100 }))
      .toBe('#80270a');
    expect(computeThreadHeadings({ accent: entry.accent, themeColor: '#42678a', threadHeadings: 0 }))
      .toBe('#42678a');
    expect(computeThreadHeadings({ accent: entry.accent, themeColor: '#42678a', threadHeadings: 100 }))
      .toBe('#80270a');
    expect(computeThreadPanelForeground({ accent: entry.accent, themeColor: '#42678a', threadForeground: 0 }))
      .toBe('#42678a');
    expect(computeThreadPanelForeground({ accent: entry.accent, themeColor: '#42678a', threadForeground: 100 }))
      .toBe('#80270a');
    expect(computeThreadAccent({ accent: entry.accent, themeColor: '#42678a', luminance: 0, threadAccent: 100 }))
      .toBe('#80270a');
    expect(computeThreadAccent({ accent: entry.accent, themeColor: '#42678a', luminance: 0, threadAccent: 50 }))
      .toBe('#61474a');
    expect(computeThreadAccent({ accent: entry.accent, themeColor: '#42678a', luminance: 0, threadAccent: 0 }))
      .toBe('#42678a');
    expect(computeThreadAccent({ accent: entry.accent, luminance: 0, threadAccent: 0 }))
      .toBe('#80270a');
    expect(computeThreadAccentContrast({ accent: entry.accent, themeColor: '#42678a', luminance: 0, threadAccent: 100 }))
      .toBe('#ffffff');
    expect(computeThreadAccentContrast({ accent: '#c14e4e', themeColor: '#eeeeee', luminance: 0, threadAccent: 0 }))
      .toBe('#000000');
    expect(computeChatBackground({ accent: entry.accent, luminance: 0, chatContrast: 0 }))
      .toBe('#c36c53');
    expect(computeChatBackground({ accent: entry.accent, luminance: 0, chatContrast: 100 }))
      .toBe('#80270a');
    expect(computeChatBackground({ accent: entry.accent, luminance: 100, chatContrast: 0 }))
      .toBe('#600f00');
    expect(computeChatBackground({ accent: entry.accent, luminance: 100, chatContrast: 100 }))
      .toBe('#80270a');
    expect(computeChatBubbleBackground({ accent: entry.accent, luminance: 0, chatContrast: 100 }))
      .toBe('#80270a');
    expect(computeChatBubbleBackground({ accent: entry.accent, luminance: 0, chatContrast: 100, chatBubble: 0 }))
      .toBe('#c36c53');
    expect(computeChatBubbleBackground({ accent: entry.accent, luminance: 0, chatContrast: 0, chatBubble: 100 }))
      .toBe('#80270a');
    expect(computeChatComposerChrome({ accent: '#0d0a24', luminance: 0, chatContrast: 0 }))
      .toBe('#ffffff');
    expect(computeChatComposerChrome({ accent: '#f0b5b5', luminance: 100, chatContrast: 100 }))
      .toBe('#f0b5b5');

    expect(panelCss.render({ ...entry, mode: 'dark', threadContrast: 0, threadForegroundContrast: 100, chatContrast: 100 }))
      .toContain('--sidebar-surface-bg:    #863216;');
    const threadCss = panelCss.render({ ...entry, themeColor: '#42678a', mode: 'dark', threadForegroundContrast: 100, threadHeadings: 0, threadForeground: 100 });
    expect(threadCss).toContain('--thread-text-color:     #80270a;');
    expect(threadCss).toContain('--thread-heading-color:  #42678a;');
    expect(threadCss).toContain('--thread-foreground-color: #80270a;');
    expect(panelCss.render({ ...entry, themeColor: '#42678a', mode: 'dark', threadAccent: 0 }))
      .toContain('--thread-selected-bg:     #42678a;');
    expect(panelCss.render({ ...entry, mode: 'dark' }))
      .toContain('--thread-selected-foreground-color: #ffffff;');
    expect(panelCss.render({ ...entry, luminance: 100, mode: 'light' }))
      .toContain('--thread-selected-foreground-color: #ffffff;');
    expect(panelCss.render({ ...entry, accent: '#c14e4e', themeColor: '#eeeeee', mode: 'dark', threadAccent: 0 }))
      .toContain('--thread-selected-foreground-color: #000000;');
    expect(panelCss.render({ ...entry, mode: 'dark', threadContrast: 0, threadForegroundContrast: 100, chatContrast: 100 }))
      .toContain('--chat-content-bg:       #80270a;');
    expect(panelCss.render({ ...entry, mode: 'dark', chatContrast: 100, chatBubble: 0 }))
      .toContain('--chat-bubble-bg:        #c36c53;');
    expect(panelCss.render({ ...entry, accent: '#0d0a24', mode: 'dark', chatContrast: 0 }))
      .toContain('--chat-composer-chrome-color: #ffffff;');
    expect(panelCss.render({ ...entry, mode: 'dark', chatBackground: 100, chatContrast: 100 }))
      .toContain('--chat-surface-bg:       #8d3d23;');
  });

  test('derives independent side-panel tokens with the thread slider paradigm', () => {
    const css = panelCss.render({
      ...entry,
      themeColor: '#42678a',
      threadBackground: 100,
      threadForegroundContrast: 0,
      threadHeadings: 100,
      threadForeground: 0,
      threadAccent: 100,
      sidePanelBackground: 0,
      sidePanelForegroundContrast: 100,
      sidePanelHeadings: 0,
      sidePanelForeground: 100,
      sidePanelAccent: 0,
    });

    expect(css).toContain('--side-panel-surface-bg:  #80270a;');
    expect(css).toContain('--side-panel-text-color:  #80270a;');
    expect(css).toContain('--side-panel-heading-color: #42678a;');
    expect(css).toContain('--side-panel-foreground-color: #80270a;');
    expect(css).toContain('--side-panel-selected-bg: #42678a;');
    expect(css).toContain('--thread-selected-bg:     #80270a;');
  });

  test('uses one Secondary Color to Background range for foreground and accent controls', () => {
    const shared = { accent: entry.accent, themeColor: '#42678a', luminance: 0 };
    expect(computeWorkspaceForeground({ ...shared, workspaceForeground: 0 })).toBe('#42678a');
    expect(computeWorkspaceForeground({ ...shared, workspaceForeground: 50 })).toBe('#61474a');
    expect(computeWorkspaceForeground({ ...shared, workspaceForeground: 100 })).toBe('#80270a');
    expect(computeWorkspaceAccent({ ...shared, workspaceAccent: 0 })).toBe('#557696');
    expect(computeWorkspaceAccent({ ...shared, workspaceAccent: 50 })).toBe('#71595c');
    expect(computeWorkspaceAccent({ ...shared, workspaceAccent: 100 })).toBe('#8d3d23');
    expect(computeWorkspaceAccent({ ...shared, workspaceAccent: 0, luminance: 100 }))
      .toBe('#3b5d7c');
    expect(computeThreadPanelForeground({ ...shared, threadForeground: 50 })).toBe('#61474a');
    expect(computeThreadAccent({ ...shared, threadAccent: 50 })).toBe('#61474a');
    expect(computeChatForeground({ ...shared, chatForeground: 50 })).toBe('#61474a');
    expect(computeContentForeground({ ...shared, contentForeground: 50 })).toBe('#61474a');
    expect(computeContentAccent({ ...shared, contentAccent: 50 })).toBe('#61474a');
    expect(computeWorkspaceBorders({ accent: entry.accent, themeColor: '#42678a', workspaceBorders: 0 }))
      .toBe(entry.accent);
    expect(computeWorkspaceBorders({ accent: entry.accent, themeColor: '#42678a', workspaceBorders: 50 }))
      .toBe('#61474a');
    expect(computeWorkspaceBorders({ accent: entry.accent, themeColor: '#42678a', workspaceBorders: 100 }))
      .toBe('#42678a');
    expect(computeWorkspaceForeground({ accent: '#000000', workspaceForeground: 0 }))
      .toBe('#000000');
    expect(computeWorkspaceBorders({ accent: '#ffffff', workspaceBorders: 0 }))
      .toBe('#ffffff');

    const css = panelCss.render({
      ...entry,
      themeColor: '#42678a',
      workspaceForeground: 100,
      workspaceBorders: 100,
      workspaceAccent: 0,
    });
    expect(css).toContain('--workspace-foreground-color: #80270a;');
    expect(css).toContain('--workspace-border-color: #42678a;');
    expect(css).toContain('--workspace-accent-color: #557696;');
  });

  test('applies the direct border color last and softens panel corners only while borders are off', () => {
    const enabledCss = themeCssGenerator.render({
      ...entry,
      themeColor: '#42678a',
      borderColor: '#315f77',
      bordersEnabled: true,
    });
    expect(enabledCss).toContain('--workspace-border-color: #315f77;');
    expect(enabledCss).toContain('--neutral-chrome-border: #315f77;');
    expect(enabledCss).toContain('--content-border: #315f77;');
    expect(enabledCss).toContain('--thread-container-border-radius: 0px;');
    expect(enabledCss).toContain('--chat-container-border-radius: 0px;');
    expect(enabledCss).toContain('--content-container-border-radius: 0px;');

    const disabledCss = themeCssGenerator.render({
      ...entry,
      themeColor: '#42678a',
      borderColor: '#315f77',
      bordersEnabled: false,
    });
    expect(disabledCss).toContain('--workspace-border-color: transparent;');
    expect(disabledCss).toContain('--neutral-chrome-border: transparent;');
    expect(disabledCss).toContain('--content-border: transparent;');
    expect(disabledCss).toContain('--thread-container-border-radius: 5px;');
    expect(disabledCss).toContain('--chat-container-border-radius: 5px;');
    expect(disabledCss).toContain('--content-container-border-radius: 5px;');
  });

  test('derives chat foreground, text, and theme-driven heading/tool ranges by mode', () => {
    expect(computeChatForeground({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatForeground: 0 }))
      .toBe('#42678a');
    expect(computeChatForeground({ accent: entry.accent, themeColor: '#42678a', luminance: 100, chatForeground: 50 }))
      .toBe('#61474a');
    expect(computeChatForeground({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatForeground: 100 }))
      .toBe('#80270a');
    expect(computeThreadForeground({ accent: '#000000', luminance: 0, threadForegroundContrast: 0 }))
      .toBe('#1a1a1a');
    expect(computeChatForeground({ accent: '#ffffff', themeColor: '#42678a', luminance: 100, chatForeground: 0 }))
      .toBe('#42678a');
    expect(computeChatForegroundContrast({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatForeground: 0 }))
      .toBe('#ffffff');
    expect(computeChatForegroundContrast({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatForeground: 100 }))
      .toBe('#ffffff');
    expect(computeChatAccent({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatAccent: 100 }))
      .toBe('#80270a');
    expect(computeChatAccent({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatAccent: 0 }))
      .toBe('#557696');
    expect(computeChatAccent({ accent: entry.accent, themeColor: '#42678a', luminance: 100, chatAccent: 0 }))
      .toBe('#3b5d7c');
    expect(computeChatTools({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatTools: 0 }))
      .toBe('#557696');
    expect(computeChatTools({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatTools: 100 }))
      .toBe('#80270a');
    expect(computeChatTools({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatAccent: 40 }))
      .toBe(computeChatAccent({ accent: entry.accent, themeColor: '#42678a', luminance: 0, chatAccent: 40 }));
    expect(computeChatAccent({ accent: '#000000', luminance: 0, chatAccent: 0 }))
      .toBe('#1a1a1a');
    expect(computeChatAccent({ accent: '#000000', luminance: 0, chatAccent: 100 }))
      .toBe('#000000');
    expect(computeChatAccent({ accent: '#ffffff', luminance: 100, chatAccent: 0 }))
      .toBe('#e6e6e6');
    expect(computeChatAccent({ accent: '#ffffff', luminance: 100, chatAccent: 100 }))
      .toBe('#ffffff');
    expect(computeChatText({ accent: entry.accent, luminance: 0, chatText: 0 }))
      .toBe('#ffffff');
    expect(computeChatText({ accent: entry.accent, luminance: 0, chatText: 100 }))
      .toBe('#c09385');
    expect(computeChatText({ accent: entry.accent, luminance: 100, chatText: 0 }))
      .toBe('#000000');
    expect(computeChatText({ accent: entry.accent, luminance: 100, chatText: 100 }))
      .toBe('#401405');

    const css = panelCss.render({
      ...entry,
      themeColor: '#42678a',
      chatForeground: 100,
      chatAccent: 0,
      chatTools: 0,
      chatText: 100,
    });
    expect(css).toContain('--chat-foreground-color: #80270a;');
    expect(css).toContain('--chat-foreground-contrast-color: #ffffff;');
    expect(css).toContain('--chat-accent-color:     #557696;');
    expect(css).toContain('--chat-tools-color:      #557696;');
    expect(css).toContain('--chat-text-color:       #c09385;');
  });

  test('keeps the content canvas at workspace background and varies only the page surface', () => {
    expect(computeContentCanvasBackground({ ...entry, contentCanvasBackground: 0 })).toBe('#80270a');
    expect(computeContentCanvasBackground({ ...entry, contentCanvasBackground: 100 })).toBe('#80270a');
    expect(computeContentBackground({ ...entry, contentCanvasBackground: 0 })).toBe('#80270a');
    expect(computeContentBackground({ ...entry, contentCanvasBackground: 50 })).toBe('#863216');
    expect(computeContentBackground({ ...entry, contentCanvasBackground: 100 })).toBe('#8d3d23');
    expect(computeContentBackground({ ...entry, luminance: 100, contentCanvasBackground: 100 })).toBe('#732309');
    expect(computeContentSurfaces({ ...entry, contentCanvasBackground: 50 })).toEqual({
      documentSurfaceBg: '#863216',
      documentBg: '#80270a',
    });
    expect(computeContentSurfaces({ ...entry, contentCanvasBackground: 100 })).toEqual({
      documentSurfaceBg: '#8d3d23',
      documentBg: '#80270a',
    });
    expect(computeContentForeground({ ...entry, themeColor: '#42678a', contentForeground: 0 })).toBe('#42678a');
    expect(computeContentForeground({ ...entry, themeColor: '#42678a', contentForeground: 100 })).toBe('#80270a');
    expect(computeContentAccent({ ...entry, themeColor: '#42678a', contentAccent: 0 })).toBe('#42678a');
    expect(computeContentAccent({ ...entry, themeColor: '#42678a', contentAccent: 100 })).toBe('#80270a');
    expect(computeContentAccentContrast({ ...entry, themeColor: '#42678a', contentAccent: 100 })).toBe('#ffffff');
    expect(computeContentAccentContrast({ accent: '#f4f4f4', themeColor: '#d8d8d8', contentAccent: 100 })).toBe('#000000');
    expect(themeCssGenerator.render({ ...entry, themeColor: '#42678a', contentForeground: 0 })).toContain('--content-foreground-color: #42678a;');
    expect(themeCssGenerator.render({ ...entry, themeColor: '#42678a', contentAccent: 0 })).toContain('--content-accent-color: #42678a;');
    expect(computeContentHeadings({ ...entry, themeColor: '#42678a', contentHeadings: 0 })).toBe('#557696');
    expect(computeContentHeadings({ ...entry, themeColor: '#42678a', luminance: 100, contentHeadings: 0 })).toBe('#3b5d7c');
    expect(computeContentHeadings({ ...entry, themeColor: '#42678a', contentHeadings: 100 })).toBe('#80270a');
    expect(computeContentText({ ...entry, contentText: 0 })).toBe('#ffffff');
    expect(computeContentText({ ...entry, contentText: 100 })).toBe('#c09385');

    const css = syntaxCss.render({
      ...entry,
      themeColor: '#42678a',
      contentBackground: 50,
      contentHeadings: 0,
      contentText: 100,
    });
    expect(css).toContain('--content-heading-color: #557696;');
    expect(css).toContain('--content-text-color: #c09385;');
    expect(css).toContain('--content-attenuated: #9d5841;');
    expect(css).toContain('--content-border:');

    const textAtZero = syntaxCss.render({
      ...entry,
      contentBackground: 50,
      contentHeadings: 0,
      contentText: 0,
    });
    expect(textAtZero).toContain('--content-attenuated: #9d5841;');
  });

  test('derives one shared structural content color for dark and light surfaces', () => {
    expect(computeContentAttenuated({
      accent: '#062137',
      luminance: 6,
      documentBg: '#09243a',
    })).toBe('#405566');
    expect(computeContentAttenuated({
      accent: '#d8e8f4',
      luminance: 94,
      documentBg: '#f4f8fb',
    })).toBe('#b7bdc1');
  });

  test('uses Content Text to brighten or mute semantic colors without moving code chrome', () => {
    expect(applyContentTextTone('#24bbd1', {
      luminance: 0,
      contentText: 0,
      documentBg: '#80270a',
    })).toBe('#50c9da');
    expect(applyContentTextTone('#24bbd1', {
      luminance: 0,
      contentText: 50,
      documentBg: '#80270a',
    })).toBe('#24bbd1');
    expect(applyContentTextTone('#24bbd1', {
      luminance: 0,
      contentText: 100,
      documentBg: '#80270a',
    })).toBe('#44878b');

    const bright = syntaxCss.render({ ...entry, contentBackground: 50, contentText: 0 });
    const muted = syntaxCss.render({ ...entry, contentBackground: 50, contentText: 100 });
    expect(bright).toContain('--hljs-keyword: #50c9da;');
    expect(muted).toContain('--hljs-keyword: #44878b;');
    expect(bright).toContain('--content-link: #ffd3b6;');
    expect(muted).toContain('--content-link: #d3906e;');
    expect(bright).toContain('--content-attenuated: #9d5841;');
    expect(muted).toContain('--content-attenuated: #9d5841;');
  });

  test('keeps automatic emphasis neutral while slider headings follow the theme endpoint', () => {
    expect(computeContentEmphasized({
      accent: '#000000',
      luminance: 0,
      contentContrast: 72,
      contentTint: 18,
      documentBg: '#000000',
    })).toBe('#ffffff');
    expect(computeContentEmphasized({
      accent: '#777777',
      luminance: 100,
      contentContrast: 72,
      contentTint: 18,
      documentBg: '#ffffff',
    })).toBe('#000000');
    expect(syntaxCss.render({
      accent: '#000000',
      luminance: 0,
      panelContrast: 0,
      contentBackground: 50,
      contentHeadings: 0,
      contentText: 0,
    })).toContain('--wiki-emphasized: #1a1a1a;');
  });
});
