const { computePanelSurfaces, computeWorkspaceForeground, computeWorkspaceBorders, computeWorkspaceAccent, computeThreadBackground, computeChatSurfaceBackground, computeThreadForeground, computeThreadHeadings, computeThreadPanelForeground, computeThreadAccent, computeThreadAccentContrast, computeChatBackground, computeChatBubbleBackground, computeChatComposerChrome, computeChatForeground, computeChatForegroundContrast, computeChatAccent, computeChatTools, computeChatText } = require('./color-math');

function render(entry) {
  const accent        = entry.accent;
  const luminance     = entry.luminance ?? 6;
  const isLight = luminance > 50;
  const { floor, surf, codeBg, panelBg } = computePanelSurfaces(entry);
  const workspaceForeground = computeWorkspaceForeground(entry);
  const workspaceBorders = computeWorkspaceBorders(entry);
  const workspaceAccent = computeWorkspaceAccent(entry);
  const threadBackground = computeThreadBackground(entry);
  const threadText = computeThreadForeground(entry);
  const threadHeadings = computeThreadHeadings(entry);
  const threadForeground = computeThreadPanelForeground(entry);
  const threadAccent = computeThreadAccent(entry);
  const selectedThreadForeground = computeThreadAccentContrast(entry);
  const sidePanelEntry = {
    ...entry,
    threadBackground: entry.sidePanelBackground ?? entry.threadBackground,
    threadForegroundContrast: entry.sidePanelForegroundContrast ?? entry.threadForegroundContrast,
    threadHeadings: entry.sidePanelHeadings ?? entry.threadHeadings,
    threadForeground: entry.sidePanelForeground ?? entry.threadForeground,
    threadAccent: entry.sidePanelAccent ?? entry.threadAccent,
  };
  const sidePanelBackground = computeThreadBackground(sidePanelEntry);
  const sidePanelText = computeThreadForeground(sidePanelEntry);
  const sidePanelHeadings = computeThreadHeadings(sidePanelEntry);
  const sidePanelForeground = computeThreadPanelForeground(sidePanelEntry);
  const sidePanelAccent = computeThreadAccent(sidePanelEntry);
  const sidePanelAccentForeground = computeThreadAccentContrast(sidePanelEntry);
  const chatSurfaceBackground = computeChatSurfaceBackground(entry);
  const chatBackground = computeChatBackground(entry);
  const chatBubbleBackground = computeChatBubbleBackground(entry);
  const chatComposerChrome = computeChatComposerChrome(entry);
  const chatForeground = computeChatForeground(entry);
  const chatForegroundContrast = computeChatForegroundContrast(entry);
  const chatAccent = computeChatAccent(entry);
  const chatTools = computeChatTools(entry);
  const chatText = computeChatText(entry);
  const interactiveContrastForeground = isLight ? '#000000' : '#ffffff';
  const neutralBorder = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)';

  return `  --bg-solid:              ${floor};
  --bg-primary:            ${floor};
  --bg-secondary:          ${surf};
  --panel-chrome-bg:       ${panelBg};
  --interactive-contrast-foreground: ${interactiveContrastForeground};
  --workspace-foreground-color: ${workspaceForeground};
  --workspace-border-color: ${workspaceBorders};
  --workspace-accent-color: ${workspaceAccent};
  --sidebar-surface-bg:    ${threadBackground};
  --thread-text-color:     ${threadText};
  --thread-heading-color:  ${threadHeadings};
  --thread-foreground-color: ${threadForeground};
  --thread-selected-bg:     ${threadAccent};
  --thread-selected-foreground-color: ${selectedThreadForeground};
  --side-panel-surface-bg:  ${sidePanelBackground};
  --side-panel-text-color:  ${sidePanelText};
  --side-panel-heading-color: ${sidePanelHeadings};
  --side-panel-foreground-color: ${sidePanelForeground};
  --side-panel-selected-bg: ${sidePanelAccent};
  --side-panel-selected-foreground-color: ${sidePanelAccentForeground};
  --chat-surface-bg:       ${chatSurfaceBackground};
  --chat-content-bg:       ${chatBackground};
  --chat-bubble-bg:        ${chatBubbleBackground};
  --chat-composer-chrome-color: ${chatComposerChrome};
  --chat-foreground-color: ${chatForeground};
  --chat-foreground-contrast-color: ${chatForegroundContrast};
  --chat-accent-color:     ${chatAccent};
  --chat-tools-color:      ${chatTools};
  --chat-text-color:       ${chatText};
  --neutral-chrome-bg:     ${surf};
  --panel-bg:              ${panelBg};
  --card-bg:           ${surf};
  --card-hover:        color-mix(in srgb, ${surf} 92%, ${accent} 8%);
  --input-bg:          ${surf};
  --chat-bg:           ${codeBg};
  --component-border:  ${neutralBorder};`;
}

module.exports = { render };
