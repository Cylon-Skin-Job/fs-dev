import { useMemo } from 'react';

export function useCacheBusterUrl(baseUrl: string, enabled: boolean): string {
  const buster = useMemo(() => (enabled ? Date.now() : 0), [baseUrl, enabled]);
  if (!enabled) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}_t=${buster}`;
}
