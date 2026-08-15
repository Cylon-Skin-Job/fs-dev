import React from 'react';
import { FrameElement } from './core/FrameElement';
import { useIframeNavigation } from './core/useIframeNavigation';
import { DEFAULT_IFRAME_SANDBOX } from './composables/sandbox';
import type { IframeNavigationOptions } from './types';

export interface IframeSurfaceProps extends IframeNavigationOptions {
  title: string;
  className?: string;
  iframeClassName?: string;
  sandbox?: string;
}

export const IframeSurface: React.FC<IframeSurfaceProps> = ({
  src,
  title,
  className,
  iframeClassName,
  enforceInitialOrigin = false,
  sandbox = DEFAULT_IFRAME_SANDBOX,
  onUrlChange,
  onBlockedNavigation,
}) => {
  const { currentSrc, iframeRef, handleLoad } = useIframeNavigation({
    src,
    enforceInitialOrigin,
    onUrlChange,
    onBlockedNavigation,
  });

  return (
    <FrameElement
      ref={iframeRef}
      src={currentSrc}
      title={title}
      className={className}
      iframeClassName={iframeClassName}
      sandbox={sandbox}
      onLoad={handleLoad}
    />
  );
};
