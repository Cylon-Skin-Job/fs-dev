import type { RefObject } from 'react';

export interface IframeNavigationOptions {
  src: string;
  enforceInitialOrigin?: boolean;
  onUrlChange?: (url: string) => void;
  onBlockedNavigation?: (url: string) => void;
}

export interface IframeNavigationResult {
  currentSrc: string;
  iframeRef: RefObject<HTMLIFrameElement | null>;
  handleLoad: () => void;
}

export interface FrameElementProps {
  src: string;
  title: string;
  className?: string;
  iframeClassName?: string;
  sandbox?: string;
  allowFullScreen?: boolean;
  onLoad?: (event: React.SyntheticEvent<HTMLIFrameElement>) => void;
}
