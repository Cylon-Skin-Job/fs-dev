export const OFFICE_PAPER_BRIGHTNESS_MIN = 0;
export const OFFICE_PAPER_BRIGHTNESS_MAX = 100;
export const OFFICE_PAPER_BRIGHTNESS_DEFAULT = 100;

const OFFICE_PAPER_MUTE_MAX_ALPHA = 0.2;

export function normalizeOfficePaperBrightness(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return OFFICE_PAPER_BRIGHTNESS_DEFAULT;
  return Math.max(OFFICE_PAPER_BRIGHTNESS_MIN, Math.min(OFFICE_PAPER_BRIGHTNESS_MAX, Math.round(numeric)));
}

export function officePaperMuteAlpha(value: unknown): string {
  const normalized = normalizeOfficePaperBrightness(value);
  const muteRatio = (OFFICE_PAPER_BRIGHTNESS_MAX - normalized) / OFFICE_PAPER_BRIGHTNESS_MAX;
  return (muteRatio * OFFICE_PAPER_MUTE_MAX_ALPHA).toFixed(3);
}
