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
  return `  --document-surface-bg:   ${documentSurfaceBg};
  --document-bg:      ${documentBg};
  --content-accent-color: ${contentAccent};
  --content-accent-foreground-color: ${contentAccentForeground};
  --content-foreground-color: ${contentForeground};`;
}

module.exports = { render };
