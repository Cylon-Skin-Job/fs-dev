import React from 'react';

export const WikiViewer: React.FC = () => {
  return (
    <iframe
      className="rv-view-iframe"
      src="fusion-studio://wiki-viewer/app/index.html"
      title="Wiki"
      sandbox="allow-scripts allow-same-origin"
    />
  );
};
