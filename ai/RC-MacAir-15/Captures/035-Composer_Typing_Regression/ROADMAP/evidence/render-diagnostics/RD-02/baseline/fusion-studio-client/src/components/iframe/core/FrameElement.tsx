import { forwardRef } from 'react';
import type { FrameElementProps } from '../types';

export const FrameElement = forwardRef<HTMLIFrameElement, FrameElementProps>(
  (
    {
      src,
      title,
      className,
      iframeClassName,
      sandbox,
      allowFullScreen = true,
      onLoad,
    },
    ref
  ) => {
    return (
      <div className={className}>
        <iframe
          ref={ref}
          className={iframeClassName}
          src={src}
          title={title}
          sandbox={sandbox}
          allowFullScreen={allowFullScreen}
          onLoad={onLoad}
        />
      </div>
    );
  }
);

FrameElement.displayName = 'FrameElement';
