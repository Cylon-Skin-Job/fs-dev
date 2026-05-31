/**
 * @module urlValidator
 * @role URL validation for browser views
 *
 * Blocks dangerous schemes, bare IP addresses, and malformed URLs.
 * Allows http://, https://, and localhost (normalized to http://localhost).
 */

const BLOCKED_SCHEMES = new Set([
  'javascript:',
  'data:',
  'file:',
  'vbscript:',
  'about:',
  'fusion-studio:',
]);

const ALLOWED_SCHEMES = new Set(['http:', 'https:']);

const IPV4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
}

function isBlockedIp(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return false;
  }
  // Block bare IPv4 addresses
  if (IPV4_REGEX.test(hostname)) {
    return true;
  }
  return false;
}

export function validateUrl(input: string): UrlValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, reason: 'Empty URL' };
  }

  let urlStr = trimmed;

  // Normalize bare localhost to http://localhost
  if (urlStr.toLowerCase().startsWith('localhost')) {
    urlStr = 'http://' + urlStr;
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    // Auto-prefix https:// for bare domains (e.g. "google.com" → "https://google.com")
    if (!urlStr.includes('://') && !urlStr.startsWith('/')) {
      try {
        parsed = new URL('https://' + urlStr);
        urlStr = 'https://' + urlStr;
      } catch {
        return { valid: false, reason: 'Invalid URL format' };
      }
    } else {
      return { valid: false, reason: 'Invalid URL format' };
    }
  }

  const scheme = parsed.protocol.toLowerCase();

  if (BLOCKED_SCHEMES.has(scheme)) {
    return { valid: false, reason: `Blocked scheme: ${scheme}` };
  }

  if (!ALLOWED_SCHEMES.has(scheme)) {
    return { valid: false, reason: `Unsupported scheme: ${scheme}` };
  }

  if (isBlockedIp(parsed.hostname)) {
    return { valid: false, reason: 'Blocked IP address' };
  }

  return { valid: true, normalizedUrl: parsed.href };
}

export function getUrlOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return '';
  }
}
