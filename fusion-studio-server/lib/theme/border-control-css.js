function validHex(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function render(entry) {
  const requestedColor = validHex(entry.borderColor)
    ? entry.borderColor
    : (validHex(entry.themeColor) ? entry.themeColor : entry.accent);
  const visibleColor = entry.bordersEnabled === false ? 'transparent' : requestedColor;
  const containerRadius = entry.bordersEnabled === false ? '5px' : '0px';

  return `  --workspace-border-color: ${visibleColor};
  --neutral-chrome-border: ${visibleColor};
  --border-color: ${visibleColor};
  --file-viewer-chrome-border: ${visibleColor};
  --component-border: ${visibleColor};
  --content-border: ${visibleColor};
  --theme-border: ${visibleColor};
  --theme-border-glow: ${visibleColor};
  --ws-panel-border: ${visibleColor};
  --thread-container-border-radius: ${containerRadius};
  --chat-container-border-radius: ${containerRadius};
  --content-container-border-radius: ${containerRadius};`;
}

module.exports = { render };
