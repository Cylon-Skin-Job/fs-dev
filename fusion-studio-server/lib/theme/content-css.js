const {
  computeContentSurfaces,
  computeContentAccent,
  computeContentAccentContrast,
  computeContentForeground,
} = require('./color-math');

function render(entry) {
  const { documentSurfaceBg, documentBg } = computeContentSurfaces(entry);
  const contentAccent = computeContentAccent(entry);
  const contentAccentForeground = computeContentAccentContrast(entry);
  const contentForeground = computeContentForeground(entry);
  const isLight = entry.mode === 'light' || (entry.mode !== 'dark' && Number(entry.luminance) > 50);
  const captureStarColor = isLight ? '#8a6a0a' : '#d6b85a';
  return `  --document-surface-bg:   ${documentSurfaceBg};
  --document-bg:      ${documentBg};
  --content-accent-color: ${contentAccent};
  --content-accent-foreground-color: ${contentAccentForeground};
  --content-foreground-color: ${contentForeground};
  --capture-star-color: ${captureStarColor};`;
}

module.exports = { render };
