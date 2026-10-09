const { luminanceToHex, mixHex } = require('./color-math');

function render(entry) {
  const accent = entry.accent;
  const borderLuminance = entry.borderLuminance ?? entry.luminance ?? 50;
  const borderTint = entry.borderTint ?? entry.borders ?? 0;

  const baseBorder = luminanceToHex(borderLuminance);
  const columnBorder = mixHex(baseBorder, accent, borderTint / 100);

  return `  --neutral-chrome-border:     ${columnBorder};
  --border-color:              ${columnBorder};
  --file-viewer-chrome-border: ${baseBorder};`;
}

module.exports = { render };
