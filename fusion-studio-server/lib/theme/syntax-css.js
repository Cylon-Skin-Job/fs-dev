const { computeSyntaxPalette, computeContentSurfaces, computeContentEmphasized, computeContentLink, computeContentBorder } = require('./color-math');

function render(entry) {
  const { documentBg } = computeContentSurfaces(entry);
  const accent = entry.accent;
  const luminance = entry.luminance ?? 6;
  const panelContrast = entry.panelContrast ?? 50;
  const contentLum = entry.contentLuminance ?? luminance;
  const contentContrast = entry.contentContrast ?? panelContrast;

  const contentTint = entry.contentTint ?? entry.bgTint ?? 12;
  const themeCode = entry.themeCode ?? false;

  const palette = computeSyntaxPalette(accent, contentLum, contentContrast, documentBg, contentTint, themeCode);
  // Parallel rainbow palette for markdown contexts — pinned to themeCode=false
  // so markdown code blocks always render with the standard rainbow regardless
  // of the Theme Code toggle. When themeCode is off, this matches `palette`.
  const paletteMd = themeCode
    ? computeSyntaxPalette(accent, contentLum, contentContrast, documentBg, contentTint, false)
    : palette;

  // Content-attenuated gray: brightness follows Content Contrast (same anchor
  // as palette.comment), tint follows Content Tint (mirrors the --text-dim
  // formula in text-css.js, but using contentTint instead of bgTint). Used by
  // line numbers and the in-content dividers.
  const isLight = luminance > 50;
  const cTint = isLight ? Math.round(contentTint * 0.4) : contentTint;
  const contentAttenuated = cTint > 0
    ? `color-mix(in srgb, ${palette.comment} ${100 - cTint}%, ${accent} ${cTint}%)`
    : palette.comment;

  // Content-emphasized: foreground tier of the content paradigm. Used by
  // wiki H1/H2/H3, active tab + breadcrumb, code-block borders, and inline
  // code backgrounds. Distance is driven by Content Contrast; chroma carries
  // the accent so the result stays in-spectrum.
  const emphasized = computeContentEmphasized({
    accent,
    luminance,
    contentContrast,
    contentTint,
    documentBg,
  });

  const link = computeContentLink({
    accent,
    luminance,
    contentContrast,
    contentTint,
    documentBg,
  });

  const border = computeContentBorder({
    luminance,
    documentBg,
  });

  const hljs = Object.entries(palette)
    .map(([k, v]) => `  --hljs-${k}: ${v};`)
    .join('\n');
  const hljsMd = Object.entries(paletteMd)
    .map(([k, v]) => `  --hljs-md-${k}: ${v};`)
    .join('\n');

  return `${hljs}
${hljsMd}
  --content-attenuated: ${contentAttenuated};
  --content-emphasized: ${emphasized};
  --content-link: ${link};
  --content-border: ${border};
  --content-highlight: color-mix(in srgb, var(--content-emphasized) 16%, transparent);`;
}

module.exports = { render };
