const { computeContentSurfaces } = require('./color-math');

function render(entry) {
  const { documentSurfaceBg, documentBg } = computeContentSurfaces(entry);
  return `  --document-surface-bg:   ${documentSurfaceBg};
  --document-bg:      ${documentBg};`;
}

module.exports = { render };
