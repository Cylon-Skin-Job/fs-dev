export interface DownloadDocumentArtifactInput {
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
}

export function downloadDocumentArtifact(input: DownloadDocumentArtifactInput): void;
