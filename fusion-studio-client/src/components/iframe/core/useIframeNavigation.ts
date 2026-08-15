import { useCallback, useEffect, useRef, useState } from 'react';
import { getUrlOrigin } from '../../browser/urlValidator';
import type { IframeNavigationOptions, IframeNavigationResult } from '../types';

export function useIframeNavigation({
  src,
  enforceInitialOrigin = false,
  onUrlChange,
  onBlockedNavigation,
}: IframeNavigationOptions): IframeNavigationResult {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialSrcRef = useRef(src);
  const pendingNavRef = useRef<string | null>(null);
  const [currentSrc, setCurrentSrc] = useState(src || 'about:blank');

  useEffect(() => {
    const nextSrc = src || 'about:blank';
    initialSrcRef.current = nextSrc;
    pendingNavRef.current = nextSrc;
    setCurrentSrc(nextSrc);
  }, [src]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.src !== currentSrc) {
      iframe.src = currentSrc;
    }
  }, [currentSrc]);

  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let loadedUrl: string | null = null;
    let isCrossOrigin = false;

    try {
      loadedUrl = iframe.contentWindow?.location.href || null;
    } catch {
      isCrossOrigin = true;
    }

    if (!loadedUrl || loadedUrl === 'about:blank') return;

    if (enforceInitialOrigin) {
      const allowedOrigin = getUrlOrigin(initialSrcRef.current);
      const loadedOrigin = getUrlOrigin(loadedUrl);
      if (allowedOrigin && loadedOrigin && loadedOrigin !== allowedOrigin) {
        onBlockedNavigation?.(loadedUrl);
        pendingNavRef.current = initialSrcRef.current;
        setCurrentSrc(initialSrcRef.current);
        return;
      }
    }

    if (isCrossOrigin) return;

    pendingNavRef.current = null;
    setCurrentSrc(loadedUrl);
    onUrlChange?.(loadedUrl);
  }, [enforceInitialOrigin, onBlockedNavigation, onUrlChange]);

  return { currentSrc, iframeRef, handleLoad };
}
