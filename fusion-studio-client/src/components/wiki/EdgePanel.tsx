/**
 * @module EdgePanel
 * @role Right column — shows incoming/outgoing edges for active topic
 * @reads wikiStore: edgesIn, edgesOut, activeTopic
 */

import { useWikiStore } from '../../state/wikiStore';

export function EdgePanel() {
  const edgesIn = useWikiStore((s) => s.edgesIn);
  const edgesOut = useWikiStore((s) => s.edgesOut);
  const navigateToTopic = useWikiStore((s) => s.navigateToTopic);

  return (
    <div className="rv-wiki-edge-panel">
      {edgesIn.length > 0 && (
        <div className="rv-wiki-edge-section">
          <div className="rv-wiki-edge-heading">
            <span className="material-symbols-outlined rv-icon-sm">arrow_back</span>
            <span>Incoming</span>
          </div>
          {edgesIn.map((slug) => (
            <button
              key={slug}
              className="rv-wiki-edge-link"
              onClick={() => navigateToTopic(slug)}
            >
              {slug}
            </button>
          ))}
        </div>
      )}
      {edgesOut.length > 0 && (
        <div className="rv-wiki-edge-section">
          <div className="rv-wiki-edge-heading">
            <span className="material-symbols-outlined rv-icon-sm">arrow_forward</span>
            <span>Outgoing</span>
          </div>
          {edgesOut.map((slug) => (
            <button
              key={slug}
              className="rv-wiki-edge-link"
              onClick={() => navigateToTopic(slug)}
            >
              {slug}
            </button>
          ))}
        </div>
      )}
      {edgesIn.length === 0 && edgesOut.length === 0 && (
        <div className="rv-wiki-edge-empty">No edges</div>
      )}
    </div>
  );
}
