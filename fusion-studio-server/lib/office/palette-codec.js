'use strict';

const { TextDecoder } = require('util');
const { PaletteError } = require('./palette-errors');

const MAX_PALETTE_BYTES = 16_384;
const VISIBLE_COLOR_LIMIT = 20;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function invalidSchema(syncEnabled) {
  throw new PaletteError('INVALID_SCHEMA', { syncEnabled });
}

function parseJson(raw, options = {}) {
  if (!Buffer.isBuffer(raw)) invalidSchema();
  if (options.enforceSizeLimit !== false && raw.length > MAX_PALETTE_BYTES) {
    throw new PaletteError('FILE_TOO_LARGE');
  }
  if (raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf) invalidSchema();
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(raw);
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalidSchema();
    return value;
  } catch (error) {
    if (error instanceof PaletteError) throw error;
    invalidSchema();
  }
}

function exactKeys(value, expected) {
  const keys = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return keys.length === sortedExpected.length && keys.every((key, index) => key === sortedExpected[index]);
}

function normalizeCustomColors(colors, syncEnabled) {
  if (!Array.isArray(colors)) invalidSchema(syncEnabled);
  const normalized = [];
  const seen = new Set();
  for (const color of colors) {
    if (typeof color !== 'string' || !COLOR_PATTERN.test(color)) invalidSchema(syncEnabled);
    const canonical = color.toLowerCase();
    if (!seen.has(canonical)) {
      seen.add(canonical);
      normalized.push(canonical);
    }
  }
  return normalized;
}

function parseLocalSelector(raw) {
  const value = parseJson(raw, { enforceSizeLimit: false });
  if (!exactKeys(value, ['custom_colors', 'sync_enabled']) || typeof value.sync_enabled !== 'boolean') {
    invalidSchema();
  }
  return { value, syncEnabled: value.sync_enabled };
}

function parseLocalConfig(raw) {
  const { value, syncEnabled } = parseLocalSelector(raw);
  if (raw.length > MAX_PALETTE_BYTES) throw new PaletteError('FILE_TOO_LARGE', { syncEnabled });
  return { customColors: normalizeCustomColors(value.custom_colors, syncEnabled), syncEnabled };
}

function parseGlobalConfig(raw) {
  const value = parseJson(raw);
  if (!exactKeys(value, ['custom_colors'])) invalidSchema(true);
  return { customColors: normalizeCustomColors(value.custom_colors, true) };
}

function localDocument(config) {
  return { custom_colors: [...config.customColors], sync_enabled: config.syncEnabled };
}

function globalDocument(customColors) {
  return { custom_colors: [...customColors] };
}

function visibleColors(customColors) {
  return customColors.slice(0, VISIBLE_COLOR_LIMIT);
}

module.exports = {
  MAX_PALETTE_BYTES,
  VISIBLE_COLOR_LIMIT,
  COLOR_PATTERN,
  normalizeCustomColors,
  parseLocalSelector,
  parseLocalConfig,
  parseGlobalConfig,
  localDocument,
  globalDocument,
  visibleColors,
};
