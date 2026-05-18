import {
  computeSyntaxPalette,
  clamp,
  hexToRgb,
  mixHex,
  luminanceToHex,
  computeContentSurfaces,
  computeContentEmphasized,
  computeContentLink,
  computeContentBorder,
} from '../../../../fusion-studio-server/lib/theme/color-math.js';

// Tokens that applyLivePreview writes — used by clearLivePreview to remove them
// when the picker unmounts so themes.css from the server takes over cleanly.
export const LIVE_PREVIEW_TOKENS = [
  '--bg-solid', '--bg-primary', '--bg-secondary',
  '--document-surface-bg', '--document-bg', '--panel-chrome-bg',
  '--sidebar-surface-bg', '--chat-surface-bg',
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
  '--content-attenuated',
  '--content-emphasized',
  '--content-link',
  '--content-border',
];

export function clearLivePreview() {
  const root = document.documentElement.style;
  for (const token of LIVE_PREVIEW_TOKENS) root.removeProperty(token);
}

export function applyLivePreview(
  accent: string,
  luminance: number,
  panelContrast: number,
  bgTint: number,
  contentLuminance: number,
  contentContrast: number,
  contentTint: number,
  borderLuminance: number,
  borderTint: number,
  chromeLuminance: number,
  chromeTint: number,
  chatBubbleChrome: boolean,
  accentLuminance: number,
  accentTint: number,
  chatBorder: boolean,
  themeCode: boolean,
) {
  const body = document.body;
  if (chatBorder) body.dataset.tintBorderChat = 'true'; else delete body.dataset.tintBorderChat;
  const root = document.documentElement.style;
  const [r, g, b] = hexToRgb(accent);
  const isLight = luminance > 50;
  const direction = isLight ? -1 : 1;
  const factor = panelContrast / 50;
  const bgT = bgTint / 100;

  // Content surfaces — shared helper ensures server/client alignment
  const { documentSurfaceBg, documentBg } = computeContentSurfaces({
    accent,
    luminance,
    panelContrast,
    bgTint,
    contentLuminance,
    contentContrast,
    contentTint,
  });

  // Panel surfaces — local calculation (panel variables unchanged)
  const surface = (l: number, t: number) => {
    const base = luminanceToHex(clamp(l));
    return t > 0 ? mixHex(base, accent, t) : base;
  };

  const floor = surface(luminance, bgT);
  const surf = surface(luminance + direction * 5 * factor, bgT);
  const codeBg = surface(luminance + direction * 8 * factor, bgT);
  const panelBg = surface(luminance + direction * 10 * factor, bgT);

  root.setProperty('--bg-solid', floor);
  root.setProperty('--bg-primary', floor);
  root.setProperty('--bg-secondary', surf);
  root.setProperty('--document-surface-bg', documentSurfaceBg);
  root.setProperty('--document-bg', documentBg);
  root.setProperty('--panel-chrome-bg', panelBg);
  root.setProperty('--sidebar-surface-bg', codeBg);
  root.setProperty('--chat-surface-bg', panelBg);
  root.setProperty('--neutral-chrome-bg', surf);
  root.setProperty('--panel-bg', panelBg);

  // Syntax palette anchored to the real document code background
  const syntaxPalette = computeSyntaxPalette(
    accent,
    contentLuminance,
    contentContrast,
    documentBg,
    contentTint,
    themeCode,
  );
  for (const [k, v] of Object.entries(syntaxPalette)) {
    root.setProperty(`--hljs-${k}`, v);
  }

  // Parallel rainbow palette for markdown — markdown is exempted from the
  // Theme Code toggle, so it always renders with the standard rainbow. When
  // themeCode is off, both palettes are identical.
  const syntaxPaletteMd = themeCode
    ? computeSyntaxPalette(
        accent,
        contentLuminance,
        contentContrast,
        documentBg,
        contentTint,
        false,
      )
    : syntaxPalette;
  for (const [k, v] of Object.entries(syntaxPaletteMd)) {
    root.setProperty(`--hljs-md-${k}`, v);
  }

  // Content-attenuated gray: brightness from palette.comment (Content
  // Contrast heuristic), tint blended from Content Tint slider. Mirrors the
  // server formula in syntax-css.js. Consumed by line numbers + in-content
  // dividers so they attenuate together with the in-content gray.
  {
    const isLightAtt = luminance > 50;
    const cTint = isLightAtt ? Math.round(contentTint * 0.4) : contentTint;
    const ccBase = syntaxPalette.comment;
    const contentAttenuated = cTint > 0
      ? `color-mix(in srgb, ${ccBase} ${100 - cTint}%, ${accent} ${cTint}%)`
      : ccBase;
    root.setProperty('--content-attenuated', contentAttenuated);
  }

  // Content-emphasized: foreground tier (headings, active labels, in-content
  // borders). Mirrors syntax-css.js → computeContentEmphasized.
  const contentEmphasized = computeContentEmphasized({
    accent,
    luminance,
    contentContrast,
    contentTint,
    documentBg,
  });
  root.setProperty('--content-emphasized', contentEmphasized);

  // Content-link: third tier — body-brightness, saturated accent. Mirrors
  // syntax-css.js → computeContentLink.
  const contentLink = computeContentLink({
    accent,
    luminance,
    contentContrast,
    contentTint,
    documentBg,
  });
  root.setProperty('--content-link', contentLink);

  // Content-border: opposite-direction sister — slightly darker than bg in
  // dark mode, slightly lighter in light mode. Mirrors computeContentBorder.
  const contentBorder = computeContentBorder({ luminance, documentBg });
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
  root.setProperty('--chat-bubble-bg', chatBubbleChrome ? 'var(--chrome-accent)' : 'var(--bg-secondary)');
  root.setProperty('--chat-bubble-fg', chatBubbleChrome ? 'var(--chrome-accent-fg)' : 'var(--text-white)');
  root.setProperty('--nav-icon-color', 'var(--chrome-accent)');
  root.setProperty('--nav-text-color', 'var(--chrome-accent)');

  root.setProperty('--ws-sidebar-bg', `color-mix(in srgb, ${floor} 92%, ${accent} 8%)`);
  root.setProperty('--ws-content-bg', `color-mix(in srgb, ${floor} 96%, ${accent} 4%)`);
  root.setProperty('--ws-panel-border', `rgba(${r}, ${g}, ${b}, 0.20)`);
}
