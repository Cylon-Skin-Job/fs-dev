const { clamp } = require('./color-math');

function luminanceToHex(luminance) {
  const ch = Math.round((luminance / 100) * 255);
  const h  = ch.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

function render(entry) {
  const accent        = entry.accent;
  const luminance     = entry.luminance ?? 6;
  const panelContrast = entry.panelContrast ?? 50;
  const bgTint        = entry.bgTint ?? entry.chromeTint ?? 12;

  const isLight   = luminance > 50;
  const direction = isLight ? -1 : 1;
  const factor    = panelContrast / 50;

  const floorL   = clamp(luminance);
  const surfaceL = clamp(luminance + direction * 5  * factor);
  const codeL    = clamp(luminance + direction * 8  * factor);
  const panelL   = clamp(luminance + direction * 10 * factor);

  function surface(l, tint) {
    const base = luminanceToHex(l);
    if (tint <= 0) return base;
    return `color-mix(in srgb, ${base} ${100 - tint}%, ${accent} ${tint}%)`;
  }

  const floor   = surface(floorL, bgTint);
  const surf    = surface(surfaceL, bgTint);
  const codeBg  = surface(codeL, bgTint);
  const panelBg = surface(panelL, bgTint);

  const neutralBorder = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';

  return `  --bg-solid:              ${floor};
  --bg-primary:            ${floor};
  --bg-secondary:          ${surf};
  --panel-chrome-bg:       ${panelBg};
  --sidebar-surface-bg:    ${codeBg};
  --chat-surface-bg:       ${panelBg};
  --neutral-chrome-bg:     ${surf};
  --panel-bg:              ${panelBg};
  --card-bg:           ${surf};
  --card-hover:        color-mix(in srgb, ${surf} 92%, ${accent} 8%);
  --input-bg:          ${surf};
  --chat-bg:           ${codeBg};
  --component-border:  ${neutralBorder};`;
}

module.exports = { render };
