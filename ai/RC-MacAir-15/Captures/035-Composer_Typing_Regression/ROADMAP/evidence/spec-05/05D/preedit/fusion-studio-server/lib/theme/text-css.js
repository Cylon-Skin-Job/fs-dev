function render(entry) {
  const luminance = entry.luminance ?? 6;
  const bgTint    = entry.bgTint ?? entry.chromeTint ?? 12;
  const accent    = entry.accent;

  const isLight = luminance > 50;

  const textP     = isLight ? '#1a1a1a' : '#ffffff';
  const textSec   = isLight ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.72)';
  const textDBase = isLight ? 'rgba(0, 0, 0, 0.60)' : 'rgba(255, 255, 255, 0.65)';
  const textSBase = isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)';
  const textTint  = isLight ? Math.round(bgTint * 0.4) : bgTint;
  const textD = textTint > 0
    ? `color-mix(in srgb, ${textDBase} ${100 - textTint}%, ${accent} ${textTint}%)`
    : textDBase;
  const textSub = textTint > 0
    ? `color-mix(in srgb, ${textSBase} ${100 - textTint}%, ${accent} ${textTint}%)`
    : textSBase;

  return `  --text-white:     ${textP};
  --text-primary:   ${textP};
  --text-secondary: ${textSec};
  --text-dim:       ${textD};
  --text-subtle:    ${textSub};
  --icon-dim:       var(--text-dim);`;
}

module.exports = { render };
