export function hasFileExtension(path: string): boolean {
  const name = basename(path);
  return /\.[^./]+$/.test(name);
}

export function isMarkdownPath(path: string): boolean {
  return /\.md$/i.test(path);
}

export function isAutocompleteFilePath(path: string): boolean {
  return hasFileExtension(path) && !isMarkdownPath(path);
}

export function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.split('/').pop() || normalized;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

export function pathSegments(path: string): string[] {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}
