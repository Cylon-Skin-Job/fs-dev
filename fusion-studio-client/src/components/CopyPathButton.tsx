/**
 * @module CopyPathButton
 * @role Reusable copy-path action button
 *
 * Thin wrapper around copyResourcePath so every view doesn't rewire its own
 * <button> + <span className="material-symbols-outlined">link_2</span>.
 *
 * Used by: FilePageView, OfficeDocumentTopbar, Wiki page nav, TicketBoard, etc.
 */

import { copyResourcePath } from '../lib/resource-path';

interface CopyPathButtonProps {
  panel: string;
  relativePath: string;
  className?: string;
  title?: string;
}

export function CopyPathButton({
  panel,
  relativePath,
  className = 'rv-file-page-action',
  title = 'Copy path',
}: CopyPathButtonProps) {
  return (
    <button
      className={className}
      onClick={() => copyResourcePath(panel, relativePath)}
      title={title}
    >
      <span className="material-symbols-outlined">link_2</span>
    </button>
  );
}
