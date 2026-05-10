const { clamp } = require('./color-math');

function luminanceToHex(luminance) {
  const ch = Math.round((luminance / 100) * 255);
  const h  = ch.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

function render(entry) {
  const accent    = entry.accent;
  const luminance = entry.luminance ?? 6;
  const bgTint    = entry.bgTint ?? entry.chromeTint ?? 12;

  const floorL = clamp(luminance);

  function surface(l, tint) {
    const base = luminanceToHex(l);
    if (tint <= 0) return base;
    return `color-mix(in srgb, ${base} ${100 - tint}%, ${accent} ${tint}%)`;
  }

  const floor = surface(floorL, bgTint);
  const [r, g, b] = hexToRgb(accent);

  return `  --ws-sidebar-bg:   color-mix(in srgb, ${floor} 92%, ${accent} 8%);
  --ws-content-bg:   color-mix(in srgb, ${floor} 96%, ${accent} 4%);
  --ws-panel-border: rgba(${r}, ${g}, ${b}, 0.20);`;
}

module.exports = { render };
