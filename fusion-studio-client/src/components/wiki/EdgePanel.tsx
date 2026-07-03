/**
 * @module EdgePanel
 * @role Right column — child nodes for the selected top-level article folder
 * @reads wikiStore: root, selectedPath, viewedPath
 */

import { findWikiNodeByPath, useWikiStore, type WikiNode } from '../../state/wikiStore';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

function NodeActions({ node, title }: { node: WikiNode; title: string }) {
  return (
    <div className="rv-wiki-item-actions" onClick={(e) => e.stopPropagation()}>
      <CopyPathButton
        panel="wiki-viewer"
        relativePath={node.pagePath}
        className="rv-file-page-action"
        title={`Copy ${title} path`}
      />
      <SendToChatButton
        panel="wiki-viewer"
        relativePath={node.pagePath}
        className="rv-file-page-action"
        title={`Send ${title} path to chat`}
      />
    </div>
  );
}

export function EdgePanel() {
  const root = useWikiStore((s) => s.root);
  const selectedPath = useWikiStore((s) => s.selectedPath);
  const viewedPath = useWikiStore((s) => s.viewedPath);
  const viewNode = useWikiStore((s) => s.viewNode);

  const node = findWikiNodeByPath(root, selectedPath);

  // Heading articles (000- folders) get the sidebar at any depth, including
  // the root's own heading article, whose kind is 'section'.
  const isHeadingArticle = Boolean(node && node.name.startsWith('000-'));

  if (!node || (node.kind !== 'article' && !isHeadingArticle)) {
    return (
      <div className="rv-wiki-edge-panel" />
    );
  }

  return (
    <div className="rv-wiki-edge-panel">
      <button
        className={`rv-wiki-edge-guide-header ${viewedPath === node.path ? 'active' : ''}`}
        onClick={() => viewNode(node)}
      >
        <span className="material-symbols-outlined">chrome_reader_mode</span>
        <span className="rv-wiki-edge-link-text rv-wiki-edge-guide-title">{node.label}</span>
        <NodeActions node={node} title="page" />
      </button>

      {node.children.map((child) => {
        const hasNestedArticles = child.children.length > 0;

        if (!hasNestedArticles) {
          return (
            <div key={child.path} className="rv-wiki-edge-section">
              <button
                className={`rv-wiki-edge-link ${viewedPath === child.path ? 'active' : ''}`}
                onClick={() => viewNode(child)}
              >
                <span className="rv-wiki-edge-link-text">{child.label}</span>
                <NodeActions node={child} title="page" />
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
            {child.children.map((nested) => (
              <button
                key={nested.path}
                className={`rv-wiki-edge-link ${viewedPath === nested.path ? 'active' : ''}`}
                onClick={() => viewNode(nested)}
              >
                <span className="rv-wiki-edge-link-text">{nested.label}</span>
                <NodeActions node={nested} title="page" />
              </button>
            ))}
          </div>
        );
      })}

      {node.children.length === 0 && (
        <div className="rv-wiki-edge-empty">No child pages loaded</div>
      )}
    </div>
  );
}
