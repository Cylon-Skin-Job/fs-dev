const { computePanelSurfaces } = require('./color-math');

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function render(entry) {
  const accent    = entry.accent;
  const { floor } = computePanelSurfaces(entry);
  const [r, g, b] = hexToRgb(accent);

  return `  --ws-sidebar-bg:   color-mix(in srgb, ${floor} 92%, ${accent} 8%);
  --ws-content-bg:   color-mix(in srgb, ${floor} 96%, ${accent} 4%);
  --ws-panel-border: rgba(${r}, ${g}, ${b}, 0.20);`;
}

module.exports = { render };
