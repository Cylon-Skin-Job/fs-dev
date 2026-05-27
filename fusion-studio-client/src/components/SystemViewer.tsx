import React from 'react';

export const SystemViewer: React.FC = () => {
  return (
    <iframe
      className="rv-view-iframe"
      src="fusion-studio://system-viewer/app/index.html"
      title="System"
      sandbox="allow-scripts allow-same-origin"
    />
  );
};
