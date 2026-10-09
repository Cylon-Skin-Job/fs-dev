/**
 * @module officeThumbnails
 * @role Shared Office document thumbnail sidecar paths.
 */

export const OFFICE_THUMBNAIL_FOLDER = '.thumbnails';

export function officeDocumentPath(folderPath: string | undefined, fileName: string): string {
  return [folderPath, fileName].filter(Boolean).join('/');
}

export function officeThumbnailPath(documentPath: string): string {
  const parts = documentPath.split('/').filter(Boolean);
  const fileName = parts.pop() || documentPath;
  return [...parts, OFFICE_THUMBNAIL_FOLDER, `${fileName}.png`].join('/');
}

export function thumbnailCacheKey(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
