const {
  computeSyntaxPalette,
  computeContentSurfaces,
  computeContentHeadings,
  computeContentText,
  applyContentTextTone,
  computeContentLink,
  computeContentBorder,
  computeContentAttenuated,
} = require('./color-math');

const AUTO_CONTENT_CONTRAST = 50;
const AUTO_CONTENT_TINT = 12;

function render(entry) {
  const { documentSurfaceBg: documentBg } = computeContentSurfaces(entry);
  const accent = entry.accent;
  const luminance = entry.luminance ?? 6;
  const contentHeadings = computeContentHeadings(entry);
  const contentText = computeContentText(entry);
  const themeCode = entry.themeCode ?? false;

  const toneSyntaxPalette = (palette) => Object.fromEntries(
    Object.entries(palette).map(([name, color]) => [
      name,
      applyContentTextTone(color, {
        luminance,
        contentText: entry.contentText,
        documentBg,
      }),
    ]),
  );

  const palette = toneSyntaxPalette(computeSyntaxPalette(
    accent,
    luminance,
    AUTO_CONTENT_CONTRAST,
    documentBg,
    AUTO_CONTENT_TINT,
    themeCode,
  ));
  palette.base = contentText;
  // Parallel rainbow palette for markdown contexts — pinned to themeCode=false
  // so markdown code blocks always render with the standard rainbow regardless
  // of the Theme Code toggle. When themeCode is off, this matches `palette`.
  const paletteMd = themeCode
    ? {
        ...toneSyntaxPalette(computeSyntaxPalette(
          accent,
          luminance,
          AUTO_CONTENT_CONTRAST,
          documentBg,
          AUTO_CONTENT_TINT,
          false,
        )),
        base: contentText,
      }
    : palette;

  const contentAttenuated = computeContentAttenuated({ accent, luminance, documentBg });

  const link = applyContentTextTone(computeContentLink({
    accent,
    luminance,
    contentContrast: AUTO_CONTENT_CONTRAST,
    contentTint: AUTO_CONTENT_TINT,
    documentBg,
  }), {
    luminance,
    contentText: entry.contentText,
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
  --content-heading-color: ${contentHeadings};
  --content-text-color: ${contentText};
  --content-attenuated: ${contentAttenuated};
  --content-emphasized: ${contentHeadings};
  --wiki-emphasized: ${contentHeadings};
  --content-link: ${link};
  --content-border: ${border};
  --content-highlight: color-mix(in srgb, var(--content-emphasized) 16%, transparent);`;
}

module.exports = { render };
