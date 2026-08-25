export function hexToHsl(hex: string): [number, number, number];
export function hslToHex(h: number, s: number, l: number): string;
export function clamp(n: number, min?: number, max?: number): number;
export function hexToRgb(hex: string): [number, number, number];
export function mixHex(a: string, b: string, ratio: number): string;
export function luminanceToHex(luminance: number): string;
export function computePanelSurfaces(entry: {
  accent: string;
  luminance?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
}): { floor: string; surf: string; codeBg: string; panelBg: string };
export function computeUiEmphasizedAccent(entry: {
  accent: string;
  luminance?: number;
}): string;
export function computeWorkspaceForeground(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  workspaceForeground?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeWorkspaceBorders(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  workspaceBorders?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeWorkspaceAccent(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  workspaceAccent?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeThreadBackground(entry: {
  accent: string;
  mode?: 'light' | 'dark' | 'unknown';
  luminance?: number;
  threadBackground?: number;
}): string;
export function computeChatSurfaceBackground(entry: {
  accent: string;
  mode?: 'light' | 'dark' | 'unknown';
  luminance?: number;
  chatBackground?: number;
}): string;
export function computeThreadForeground(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  threadForegroundContrast?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeThreadHeadings(entry: {
  accent: string;
  themeColor?: string;
  threadHeadings?: number;
}): string;
export function computeThreadPanelForeground(entry: {
  accent: string;
  themeColor?: string;
  threadForeground?: number;
}): string;
export function computeThreadAccent(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  threadAccent?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeThreadAccentContrast(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  threadAccent?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeChatBackground(entry: {
  accent: string;
  luminance?: number;
  chatContrast?: number;
}): string;
export function computeChatBubbleBackground(entry: {
  accent: string;
  luminance?: number;
  chatBubble?: number;
  chatContrast?: number;
}): string;
export function computeChatComposerChrome(entry: {
  accent: string;
  luminance?: number;
  chatContrast?: number;
}): string;
export function computeChatForeground(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  chatForeground?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeChatForegroundContrast(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  chatForeground?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeChatAccent(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  chatAccent?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeChatTools(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  chatTools?: number;
  chatAccent?: number;
  panelContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentContrast?: number;
  contentTint?: number;
}): string;
export function computeChatText(entry: {
  accent: string;
  luminance?: number;
  chatText?: number;
}): string;
export function computeContentCanvasBackground(entry: {
  accent: string;
  mode?: 'light' | 'dark' | 'unknown';
  luminance?: number;
  contentCanvasBackground?: number;
}): string;
export function computeContentBackground(entry: {
  accent: string;
  mode?: 'light' | 'dark' | 'unknown';
  luminance?: number;
  contentCanvasBackground?: number;
}): string;
export function computeContentAccent(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  contentAccent?: number;
}): string;
export function computeContentAccentContrast(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  contentAccent?: number;
}): string;
export function computeContentForeground(entry: {
  accent: string;
  themeColor?: string;
  contentForeground?: number;
}): string;
export function computeContentHeadings(entry: {
  accent: string;
  themeColor?: string;
  luminance?: number;
  contentHeadings?: number;
}): string;
export function computeContentText(entry: {
  accent: string;
  luminance?: number;
  contentText?: number;
}): string;
export function applyContentTextTone(color: string, entry: {
  luminance?: number;
  contentText?: number;
  documentBg: string;
}): string;
export function computeContentAttenuated(entry: {
  accent: string;
  luminance?: number;
  documentBg: string;
}): string;
export function computeContentSurfaces(entry: {
  accent: string;
  mode?: 'light' | 'dark' | 'unknown';
  luminance?: number;
  contentCanvasBackground?: number;
  panelContrast?: number;
  contentContrast?: number;
  bgTint?: number;
  chromeTint?: number;
  contentTint?: number;
  contentLuminance?: number;
}): { documentSurfaceBg: string; documentBg: string };
export function computeSyntaxPalette(
  accent: string,
  contentLuminance: number,
  contentContrast: number,
  codeBgHex?: string,
  contentTint?: number,
  themeCode?: boolean
): Record<string, string>;
export function computeContentEmphasized(args: {
  accent: string;
  luminance?: number;
  contentContrast?: number;
  contentTint?: number;
  documentBg: string;
}): string;
export function computeContentLink(args: {
  accent: string;
  luminance?: number;
  contentContrast?: number;
  contentTint?: number;
  documentBg: string;
}): string;
export function computeContentBorder(args: {
  luminance?: number;
  documentBg: string;
}): string;

export const CONTENT_LUMINANCE_CATALOG: {
  dark:  { min: number; max: number };
  light: { min: number; max: number };
};

export const CONTENT_SURFACE_CATALOG: {
  dark:  { surfaceOffset: number; codeOffset: number };
  light: { surfaceOffset: number; codeOffset: number };
};
