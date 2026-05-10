export function hexToHsl(hex: string): [number, number, number];
export function hslToHex(h: number, s: number, l: number): string;
export function clamp(n: number, min?: number, max?: number): number;
export function hexToRgb(hex: string): [number, number, number];
export function mixHex(a: string, b: string, ratio: number): string;
export function luminanceToHex(luminance: number): string;
export function computeContentSurfaces(entry: {
  accent: string;
  luminance?: number;
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
