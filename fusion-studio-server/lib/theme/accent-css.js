const { luminanceToHex, mixHex } = require('./color-math');

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

/** Pick a foreground for surfaces filled with the given hex bg.
 *  - Dark bg → white (clean on saturated darks)
 *  - Light bg → --chrome-accent (the Chrome family — dim structural companion
 *    to a bright accent; avoids flat black which clashes with vibrant accents).
 */
function pickContrastFg(hex) {
  const [r, g, b] = hexToRgb(hex);
  // W3C-style relative luminance approximation in sRGB.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? 'var(--chrome-accent)' : '#ffffff';
}

function render(entry) {
  const accent = entry.accent;
  const chromeLuminance = entry.chromeLuminance ?? entry.luminance ?? 6;
  const chromeTint = entry.chromeTint ?? 18;
  const [r, g, b] = hexToRgb(accent);

  const chromeBase = luminanceToHex(chromeLuminance);
  const chromeAccent = mixHex(chromeBase, accent, chromeTint / 100);
  // Foreground for surfaces filled with --chrome-accent (active thread,
  // dock button, active wiki topic). Flips light/dark so text stays legible
  // when the user picks a bright accent in light mode.
  const chromeAccentFg = pickContrastFg(chromeAccent);

  const accentLuminance = entry.accentLuminance ?? entry.luminance ?? 6;
  const accentTint = entry.accentTint ?? 0;
  const accentDimBase = luminanceToHex(accentLuminance);
  const accentDim = mixHex(accentDimBase, accent, accentTint / 100);

  // Workspace navigation has its own foreground family. The selected item
  // is styled separately with --workspace-accent-color.
  const navIconColor = 'var(--workspace-foreground-color)';
  const navTextColor = 'var(--workspace-foreground-color)';

  return `  --theme-primary:     ${accent};
  --theme-primary-rgb: ${r}, ${g}, ${b};
  --theme-border:      rgba(${r}, ${g}, ${b}, 0.38);
  --theme-border-glow: rgba(${r}, ${g}, ${b}, 0.68);
  --ws-primary:        var(--theme-primary);
  --ws-primary-rgb:    var(--theme-primary-rgb);
  --chrome-accent:     ${accentDim};
  --chrome-accent-fg:  ${chromeAccentFg};
  --cli-accent:        var(--accent-dim);
  --tile-color:        var(--accent-dim);
  --accent-dim:        ${chromeAccent};
  --chat-bubble-fg:    var(--text-white);
  --nav-icon-color:    ${navIconColor};
  --nav-text-color:    ${navTextColor};`;
}

module.exports = { render };
