import {
  computeSyntaxPalette,
  clamp,
  hexToRgb,
  mixHex,
  luminanceToHex,
  computePanelSurfaces,
  computeWorkspaceForeground,
  computeWorkspaceAccent,
  computeThreadBackground,
  computeChatSurfaceBackground,
  computeThreadForeground,
  computeThreadHeadings,
  computeThreadPanelForeground,
  computeThreadAccent,
  computeThreadAccentContrast,
  computeChatBackground,
  computeChatBubbleBackground,
  computeChatComposerChrome,
  computeChatForeground,
  computeChatForegroundContrast,
  computeChatAccent,
  computeChatTools,
  computeChatText,
  computeContentAccent,
  computeContentAccentContrast,
  computeContentForeground,
  computeContentHeadings,
  computeContentText,
  applyContentTextTone,
  computeContentSurfaces,
  computeContentLink,
  computeContentBorder,
  computeContentAttenuated,
} from '../../../../fusion-studio-server/lib/theme/color-math.js';

// Tokens that applyLivePreview writes — used by clearLivePreview to remove them
// when the picker unmounts so themes.css from the server takes over cleanly.
export const LIVE_PREVIEW_TOKENS = [
  '--bg-solid', '--bg-primary', '--bg-secondary',
  '--document-surface-bg', '--document-bg', '--content-accent-color', '--content-accent-foreground-color', '--content-foreground-color', '--panel-chrome-bg',
  '--workspace-foreground-color', '--workspace-border-color', '--workspace-accent-color', '--sidebar-surface-bg', '--thread-text-color', '--thread-heading-color', '--thread-foreground-color', '--thread-selected-bg', '--thread-selected-foreground-color',
  '--side-panel-surface-bg', '--side-panel-text-color', '--side-panel-heading-color', '--side-panel-foreground-color', '--side-panel-selected-bg', '--side-panel-selected-foreground-color',
  '--chat-surface-bg', '--chat-content-bg', '--chat-composer-chrome-color', '--chat-foreground-color', '--chat-foreground-contrast-color', '--chat-accent-color', '--chat-tools-color', '--chat-text-color', '--thread-surface-bg',
  '--neutral-chrome-bg', '--panel-bg',
  '--text-white', '--text-primary', '--text-secondary', '--text-dim', '--text-subtle',
  '--neutral-chrome-border', '--border-color', '--file-viewer-chrome-border',
  '--card-bg', '--card-hover', '--input-bg', '--chat-bg', '--component-border',
  '--theme-primary', '--theme-primary-rgb', '--theme-border', '--theme-border-glow',
  '--ws-primary', '--ws-primary-rgb',
  '--ws-sidebar-bg', '--ws-content-bg', '--ws-panel-border',
  '--cli-accent', '--tile-color',
  '--chrome-accent', '--chrome-accent-fg', '--icon-dim', '--accent-dim',
  '--chat-bubble-bg', '--chat-bubble-fg',
  '--nav-icon-color',
  '--nav-text-color',
  '--hljs-keyword', '--hljs-function', '--hljs-number', '--hljs-string',
  '--hljs-class', '--hljs-section', '--hljs-comment', '--hljs-base',
  '--hljs-md-keyword', '--hljs-md-function', '--hljs-md-number', '--hljs-md-string',
  '--hljs-md-class', '--hljs-md-section', '--hljs-md-comment', '--hljs-md-base',
  '--content-heading-color',
  '--content-text-color',
  '--content-attenuated',
  '--content-emphasized',
  '--wiki-emphasized',
  '--content-link',
  '--content-border',
  '--thread-container-border-radius',
  '--chat-container-border-radius',
  '--content-container-border-radius',
];

export function clearLivePreview() {
  const root = document.documentElement.style;
  for (const token of LIVE_PREVIEW_TOKENS) root.removeProperty(token);
}

export function applyLivePreview(
  accent: string,
  luminance: number,
  panelContrast: number,
  workspaceForeground: number,
  workspaceBorders: number,
  workspaceAccent: number,
  threadBackgroundValue: number,
  threadForegroundContrast: number,
  threadHeadings: number,
  threadPanelForeground: number,
  threadAccent: number,
  sidePanelBackground: number,
  sidePanelForegroundContrast: number,
  sidePanelHeadings: number,
  sidePanelForeground: number,
  sidePanelAccent: number,
  chatBackgroundValue: number,
  chatContrast: number,
  chatBubble: number,
  chatForeground: number,
  chatAccent: number,
  chatTools: number,
  chatText: number,
  bgTint: number,
  contentCanvasBackground: number,
  contentAccent: number,
  contentForeground: number,
  contentHeadings: number,
  contentText: number,
  borderLuminance: number,
  borderTint: number,
  chromeLuminance: number,
  chromeTint: number,
  accentLuminance: number,
  accentTint: number,
  chatBorder: boolean,
  themeCode: boolean,
  themeColor: string,
  borderColor: string,
  bordersEnabled: boolean,
) {
  const body = document.body;
  if (chatBorder) body.dataset.tintBorderChat = 'true'; else delete body.dataset.tintBorderChat;
  const root = document.documentElement.style;
  const [r, g, b] = hexToRgb(accent);
  const isLight = luminance > 50;

  // Content surfaces — shared helper ensures server/client alignment
  const { documentSurfaceBg, documentBg } = computeContentSurfaces({
    accent,
    mode: isLight ? 'light' : 'dark',
    luminance,
    contentCanvasBackground,
  });
  const contentDocumentBg = documentSurfaceBg;
  const secondaryAccent = /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : accent;
  const contentAccentEntry = { accent, themeColor: secondaryAccent, luminance, contentAccent };
  const contentAccentColor = computeContentAccent(contentAccentEntry);
  const contentAccentForegroundColor = computeContentAccentContrast(contentAccentEntry);
  const contentForegroundColor = computeContentForeground({ accent, themeColor: secondaryAccent, contentForeground });
  const contentHeadingColor = computeContentHeadings({ accent, themeColor: secondaryAccent, luminance, contentHeadings });
  const contentTextColor = computeContentText({ accent, luminance, contentText });

  // Shared with the server generator so live preview and persisted CSS agree.
  const { floor, surf, codeBg, panelBg } = computePanelSurfaces({
    accent,
    luminance,
    panelContrast,
    bgTint,
  });
  const workspaceForegroundColor = computeWorkspaceForeground({
    accent,
    themeColor: secondaryAccent,
    luminance,
    workspaceForeground,
  });
  const workspaceBorderColor = mixHex(
    accent,
    secondaryAccent,
    clamp(workspaceBorders) / 100,
  );
  const workspaceAccentColor = computeWorkspaceAccent({
    accent,
    themeColor: secondaryAccent,
    luminance,
    workspaceAccent,
  });
  const threadBackground = computeThreadBackground({
    accent,
    mode: isLight ? 'light' : 'dark',
    luminance,
    threadBackground: threadBackgroundValue,
  });
  const threadTextColor = computeThreadForeground({
    accent,
    themeColor: secondaryAccent,
    luminance,
    threadForegroundContrast,
  });
  const threadHeadingColor = computeThreadHeadings({
    accent,
    themeColor: secondaryAccent,
    threadHeadings,
  });
  const threadForegroundColor = computeThreadPanelForeground({
    accent,
    themeColor: secondaryAccent,
    threadForeground: threadPanelForeground,
  });
  const threadAccentEntry = { accent, themeColor: secondaryAccent, luminance, threadAccent };
  const selectedThreadBackground = computeThreadAccent(threadAccentEntry);
  const selectedThreadForeground = computeThreadAccentContrast(threadAccentEntry);
  const sidePanelEntry = {
    accent,
    themeColor: secondaryAccent,
    luminance,
    threadBackground: sidePanelBackground,
    threadForegroundContrast: sidePanelForegroundContrast,
    threadHeadings: sidePanelHeadings,
    threadForeground: sidePanelForeground,
    threadAccent: sidePanelAccent,
  };
  const sidePanelSurfaceBackground = computeThreadBackground(sidePanelEntry);
  const sidePanelTextColor = computeThreadForeground(sidePanelEntry);
  const sidePanelHeadingColor = computeThreadHeadings(sidePanelEntry);
  const sidePanelForegroundColor = computeThreadPanelForeground(sidePanelEntry);
  const sidePanelSelectedBackground = computeThreadAccent(sidePanelEntry);
  const sidePanelSelectedForeground = computeThreadAccentContrast(sidePanelEntry);
  const chatSurfaceBackground = computeChatSurfaceBackground({
    accent,
    mode: isLight ? 'light' : 'dark',
    luminance,
    chatBackground: chatBackgroundValue,
  });
  const chatBackground = computeChatBackground({
    accent,
    luminance,
    chatContrast,
  });
  const chatBubbleBackground = computeChatBubbleBackground({
    accent,
    luminance,
    chatBubble,
    chatContrast,
  });
  const chatComposerChrome = computeChatComposerChrome({
    accent,
    luminance,
    chatContrast,
  });
  const chatForegroundColor = computeChatForeground({
    accent,
    themeColor: secondaryAccent,
    luminance,
    chatForeground,
    panelContrast,
    bgTint,
  });
  const chatForegroundContrastColor = computeChatForegroundContrast({
    accent,
    themeColor: secondaryAccent,
    luminance,
    chatForeground,
    panelContrast,
    bgTint,
  });
  const chatAccentColor = computeChatAccent({
    accent,
    themeColor: secondaryAccent,
    luminance,
    chatAccent,
    panelContrast,
    bgTint,
  });
  const chatToolsColor = computeChatTools({
    accent,
    themeColor: secondaryAccent,
    luminance,
    chatTools,
    panelContrast,
    bgTint,
  });
  const chatTextColor = computeChatText({
    accent,
    luminance,
    chatText,
  });

  root.setProperty('--bg-solid', floor);
  root.setProperty('--bg-primary', floor);
  root.setProperty('--bg-secondary', surf);
  root.setProperty('--document-surface-bg', documentSurfaceBg);
  root.setProperty('--document-bg', documentBg);
  root.setProperty('--content-accent-color', contentAccentColor);
  root.setProperty('--content-accent-foreground-color', contentAccentForegroundColor);
  root.setProperty('--content-foreground-color', contentForegroundColor);
  root.setProperty('--panel-chrome-bg', panelBg);
  root.setProperty('--workspace-foreground-color', workspaceForegroundColor);
  root.setProperty('--workspace-border-color', workspaceBorderColor);
  root.setProperty('--workspace-accent-color', workspaceAccentColor);
  root.setProperty('--sidebar-surface-bg', threadBackground);
  root.setProperty('--thread-text-color', threadTextColor);
  root.setProperty('--thread-heading-color', threadHeadingColor);
  root.setProperty('--thread-foreground-color', threadForegroundColor);
  root.setProperty('--thread-selected-bg', selectedThreadBackground);
  root.setProperty('--thread-selected-foreground-color', selectedThreadForeground);
  root.setProperty('--side-panel-surface-bg', sidePanelSurfaceBackground);
  root.setProperty('--side-panel-text-color', sidePanelTextColor);
  root.setProperty('--side-panel-heading-color', sidePanelHeadingColor);
  root.setProperty('--side-panel-foreground-color', sidePanelForegroundColor);
  root.setProperty('--side-panel-selected-bg', sidePanelSelectedBackground);
  root.setProperty('--side-panel-selected-foreground-color', sidePanelSelectedForeground);
  root.setProperty('--chat-surface-bg', chatSurfaceBackground);
  root.setProperty('--chat-content-bg', chatBackground);
  root.setProperty('--chat-bubble-bg', chatBubbleBackground);
  root.setProperty('--chat-composer-chrome-color', chatComposerChrome);
  root.setProperty('--chat-foreground-color', chatForegroundColor);
  root.setProperty('--chat-foreground-contrast-color', chatForegroundContrastColor);
  root.setProperty('--chat-accent-color', chatAccentColor);
  root.setProperty('--chat-tools-color', chatToolsColor);
  root.setProperty('--chat-text-color', chatTextColor);
  root.setProperty('--neutral-chrome-bg', surf);
  root.setProperty('--panel-bg', panelBg);

  root.setProperty('--content-heading-color', contentHeadingColor);
  root.setProperty('--content-text-color', contentTextColor);
  root.setProperty('--content-emphasized', contentHeadingColor);
  root.setProperty('--wiki-emphasized', contentHeadingColor);

  // Syntax palette anchored to the real document code background
  const toneSyntaxPalette = (palette: Record<string, string>) => Object.fromEntries(
    Object.entries(palette).map(([name, color]) => [
      name,
      applyContentTextTone(color, { luminance, contentText, documentBg: contentDocumentBg }),
    ]),
  );
  const syntaxPalette = toneSyntaxPalette(computeSyntaxPalette(
    accent,
    luminance,
    50,
    contentDocumentBg,
    12,
    themeCode,
  ));
  syntaxPalette.base = contentTextColor;
  for (const [k, v] of Object.entries(syntaxPalette)) {
    root.setProperty(`--hljs-${k}`, v);
  }

  // Parallel rainbow palette for markdown — markdown is exempted from the
  // Theme Code toggle, so it always renders with the standard rainbow. When
  // themeCode is off, both palettes are identical.
  const syntaxPaletteMd = themeCode
    ? toneSyntaxPalette(computeSyntaxPalette(
        accent,
        luminance,
        50,
        contentDocumentBg,
        12,
        false,
      ))
    : syntaxPalette;
  syntaxPaletteMd.base = contentTextColor;
  for (const [k, v] of Object.entries(syntaxPaletteMd)) {
    root.setProperty(`--hljs-md-${k}`, v);
  }

  // Shared automatic structural color for metadata, dividers, and content
  // card outlines. Independent from Content Text and Borders.
  root.setProperty('--content-attenuated', computeContentAttenuated({
    accent,
    luminance,
    documentBg: contentDocumentBg,
  }));

  // Content-link: third tier — body-brightness, saturated accent. Mirrors
  // syntax-css.js → computeContentLink.
  const contentLink = applyContentTextTone(computeContentLink({
    accent,
    luminance,
    contentContrast: 50,
    contentTint: 12,
    documentBg: contentDocumentBg,
  }), { luminance, contentText, documentBg: contentDocumentBg });
  root.setProperty('--content-link', contentLink);

  // Content-border: opposite-direction sister — slightly darker than bg in
  // dark mode, slightly lighter in light mode. Mirrors computeContentBorder.
  const contentBorder = computeContentBorder({ luminance, documentBg: contentDocumentBg });
  root.setProperty('--content-border', contentBorder);

  // Text hierarchy — aligned byte-for-byte with server renderSlugToCss
  const textP = isLight ? '#1a1a1a' : '#ffffff';
  const textSec = isLight ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.72)';
  const textDBase = isLight ? 'rgba(0, 0, 0, 0.60)' : 'rgba(255, 255, 255, 0.65)';
  const textSBase = isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)';
  const textTint = isLight ? Math.round(bgTint * 0.4) : bgTint;
  const textDim = textTint > 0
    ? `color-mix(in srgb, ${textDBase} ${100 - textTint}%, ${accent} ${textTint}%)`
    : textDBase;
  const textSubtle = textTint > 0
    ? `color-mix(in srgb, ${textSBase} ${100 - textTint}%, ${accent} ${textTint}%)`
    : textSBase;

  root.setProperty('--text-white', textP);
  root.setProperty('--text-primary', textP);
  root.setProperty('--text-secondary', textSec);
  root.setProperty('--text-dim', textDim);
  root.setProperty('--text-subtle', textSubtle);

  const baseBorder = luminanceToHex(clamp(borderLuminance));
  const columnBorder = mixHex(baseBorder, accent, clamp(borderTint) / 100);
  root.setProperty('--neutral-chrome-border', columnBorder);
  root.setProperty('--border-color', columnBorder);
  root.setProperty('--file-viewer-chrome-border', baseBorder);

  root.setProperty('--card-bg', surf);
  root.setProperty('--card-hover', `color-mix(in srgb, ${surf} 92%, ${accent} 8%)`);
  root.setProperty('--input-bg', surf);
  root.setProperty('--chat-bg', codeBg);
  root.setProperty('--component-border', columnBorder);

  root.setProperty('--theme-primary', accent);
  root.setProperty('--theme-primary-rgb', `${r}, ${g}, ${b}`);
  root.setProperty('--theme-border', `rgba(${r}, ${g}, ${b}, 0.38)`);
  root.setProperty('--theme-border-glow', `rgba(${r}, ${g}, ${b}, 0.68)`);
  root.setProperty('--ws-primary', 'var(--theme-primary)');
  root.setProperty('--ws-primary-rgb', 'var(--theme-primary-rgb)');

  const chromeBase = luminanceToHex(clamp(chromeLuminance));
  const chromeAccent = mixHex(chromeBase, accent, clamp(chromeTint) / 100);
  const accentDimBase = luminanceToHex(clamp(accentLuminance));
  const accentDim = mixHex(accentDimBase, accent, clamp(accentTint) / 100);

  root.setProperty('--chrome-accent', accentDim);

  // Contrast foreground for surfaces filled with --accent-dim (bright accent).
  // Mirrors accent-css.js → pickContrastFg. Light accent → fall back to the
  // dim structural chrome (--chrome-accent) instead of flat black.
  {
    const [cr, cg, cb] = hexToRgb(chromeAccent);
    const lum = (0.2126 * cr + 0.7152 * cg + 0.0722 * cb) / 255;
    root.setProperty('--chrome-accent-fg', lum > 0.55 ? 'var(--chrome-accent)' : '#ffffff');
  }

  root.setProperty('--accent-dim', chromeAccent);

  root.setProperty('--icon-dim', 'var(--text-dim)');
  root.setProperty('--cli-accent', 'var(--accent-dim)');
  root.setProperty('--tile-color', 'var(--accent-dim)');
  root.setProperty('--chat-bubble-fg', 'var(--text-white)');
  root.setProperty('--nav-icon-color', 'var(--workspace-foreground-color)');
  root.setProperty('--nav-text-color', 'var(--workspace-foreground-color)');

  root.setProperty('--ws-sidebar-bg', `color-mix(in srgb, ${floor} 92%, ${accent} 8%)`);
  root.setProperty('--ws-content-bg', `color-mix(in srgb, ${floor} 96%, ${accent} 4%)`);
  root.setProperty('--ws-panel-border', `rgba(${r}, ${g}, ${b}, 0.20)`);

  // Direct border control is applied last so it remains authoritative over
  // the legacy luminance/tint derivations retained for older saved themes.
  const resolvedBorderColor = /^#[0-9a-fA-F]{6}$/.test(borderColor)
    ? borderColor
    : secondaryAccent;
  const visibleBorderColor = bordersEnabled ? resolvedBorderColor : 'transparent';
  root.setProperty('--workspace-border-color', visibleBorderColor);
  root.setProperty('--neutral-chrome-border', visibleBorderColor);
  root.setProperty('--border-color', visibleBorderColor);
  root.setProperty('--file-viewer-chrome-border', visibleBorderColor);
  root.setProperty('--component-border', visibleBorderColor);
  root.setProperty('--content-border', visibleBorderColor);
  root.setProperty('--theme-border', visibleBorderColor);
  root.setProperty('--theme-border-glow', visibleBorderColor);
  root.setProperty('--ws-panel-border', visibleBorderColor);

  const containerRadius = bordersEnabled ? '0px' : '5px';
  root.setProperty('--thread-container-border-radius', containerRadius);
  root.setProperty('--chat-container-border-radius', containerRadius);
  root.setProperty('--content-container-border-radius', containerRadius);
}
