/**
 * @module EdgePanel
 * @role Right column — child nodes for the selected top-level article folder
 * @reads wikiStore: root, selectedPath, viewedPath
 */

import {
  findWikiNodeByPath,
  isWikiHeadingArticle,
  isWikiRightNavContext,
  useWikiStore,
} from '../../state/wikiStore';
import { FloatingPathActions } from '../FloatingPathActions';
import { ContentNavRightResize } from '../ResizeHandle';

export function EdgePanel() {
  const root = useWikiStore((s) => s.root);
  const selectedPath = useWikiStore((s) => s.selectedPath);
  const viewedPath = useWikiStore((s) => s.viewedPath);
  const viewedPagePath = useWikiStore((s) => s.viewedPagePath);
  const viewNode = useWikiStore((s) => s.viewNode);

  const node = findWikiNodeByPath(root, selectedPath);

  // Only non-heading top-level article folders get contextual child navigation.
  if (!isWikiRightNavContext(node)) {
    return (
      <div className="rv-wiki-edge-panel">
        <ContentNavRightResize panel="wiki-viewer" />
        <div className="rv-wiki-edge-panel-scroll" />
      </div>
    );
  }

  return (
    <div className="rv-wiki-edge-panel">
      <ContentNavRightResize panel="wiki-viewer" />
      <div className="rv-wiki-edge-panel-scroll">
        <button
          className={`rv-wiki-edge-guide-header ${viewedPath === node.path ? 'active' : ''}`}
          onClick={() => viewNode(node)}
        >
          <span className="material-symbols-outlined">chrome_reader_mode</span>
          <span className="rv-wiki-edge-link-text rv-wiki-edge-guide-title">{node.label}</span>
        </button>

        {node.children.filter((child) => !isWikiHeadingArticle(child)).map((child) => {
        const nestedArticles = child.children.filter((nested) => !isWikiHeadingArticle(nested));
        const hasNestedArticles = nestedArticles.length > 0;

        if (!hasNestedArticles) {
          return (
            <div key={child.path} className="rv-wiki-edge-section">
              <button
                className={`rv-wiki-edge-link ${viewedPath === child.path ? 'active' : ''}`}
                onClick={() => viewNode(child)}
              >
                <span className="rv-wiki-topic-indicator">
                  {viewedPath === child.path ? '\u25C9' : '\u25CB'}
                </span>
                <span className="rv-wiki-edge-link-text">{child.label}</span>
              </button>
            </div>
          );
        }

        return (
          <div key={child.path} className="rv-wiki-edge-section">
            <button
              className={`rv-wiki-edge-heading rv-wiki-edge-heading-button ${viewedPath === child.path ? 'active' : ''}`}
              onClick={() => viewNode(child)}
            >
              {child.label}
            </button>
            {nestedArticles.map((nested) => (
              <button
                key={nested.path}
                className={`rv-wiki-edge-link ${viewedPath === nested.path ? 'active' : ''}`}
                onClick={() => viewNode(nested)}
              >
                <span className="rv-wiki-topic-indicator">
                  {viewedPath === nested.path ? '\u25C9' : '\u25CB'}
                </span>
                <span className="rv-wiki-edge-link-text">{nested.label}</span>
              </button>
            ))}
          </div>
        );
        })}

        {node.children.length === 0 && (
          <div className="rv-wiki-edge-empty">No child pages loaded</div>
        )}
      </div>
      {viewedPagePath ? (
        <FloatingPathActions
          panel="wiki-viewer"
          relativePath={viewedPagePath}
          copyTitle="Copy page path"
          sendTitle="Send page path to chat"
          ariaLabel="Wiki edge panel actions"
        />
      ) : null}
    </div>
  );
}
