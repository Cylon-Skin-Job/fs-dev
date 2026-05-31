/**
 * @module favicon
 * @role Resolve favicon URLs for bookmarks using Google's favicon service
 */

export function getFaviconUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`;
  } catch {
    return '';
  }
}
