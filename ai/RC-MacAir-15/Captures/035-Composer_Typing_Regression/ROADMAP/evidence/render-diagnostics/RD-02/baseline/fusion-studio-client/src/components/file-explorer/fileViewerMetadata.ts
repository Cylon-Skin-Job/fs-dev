import type { FileResourceMetadata } from '../../state/fileDataStore';
import type { FileInfo } from '../../types/file-explorer';

type PresentationSymlinkMetadata = Pick<FileInfo, 'isSymlink' | 'symlinkTarget'>;

/**
 * Persisted/tree metadata is a pre-read hint only. Once a content read has
 * produced current canonical metadata, including an authoritative regular
 * file result, presentation hints must not override it.
 */
export function resolveFileViewerSymlink(
  canonical: FileResourceMetadata | undefined,
  presentation: PresentationSymlinkMetadata | null,
): { isSymlink: boolean; symlinkTarget?: string } {
  if (canonical) {
    return canonical.isSymlink === true
      ? { isSymlink: true, symlinkTarget: canonical.symlinkTarget }
      : { isSymlink: false };
  }
  return presentation?.isSymlink === true
    ? { isSymlink: true, symlinkTarget: presentation.symlinkTarget }
    : { isSymlink: false };
}
