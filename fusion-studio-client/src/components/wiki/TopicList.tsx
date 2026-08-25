/**
 * @module TopicList
 * @role Left sidebar — lists wiki folder-tree nodes and highlights active
 * @reads wikiStore: root, selectedPath
 */

import { findHeadingArticle, useWikiStore } from '../../state/wikiStore';
import { CopyPathButton } from '../CopyPathButton';
import { ContentNavLeftResize } from '../ResizeHandle';
import { SendToChatButton } from '../SendToChatButton';

export function TopicList() {
  const root = useWikiStore((s) => s.root);
  const selectedPath = useWikiStore((s) => s.selectedPath);
  const selectNode = useWikiStore((s) => s.selectNode);

  if (!root) return null;

  const guideNode = findHeadingArticle(root) || root;

  return (
    <div className="rv-wiki-topic-list">
      <ContentNavLeftResize panel="wiki-viewer" />
      <div className="rv-wiki-topic-list-scroll">
        <div className="rv-wiki-topic-list-items">
          <div className="rv-wiki-collection-group">
            <button
              className={`rv-wiki-topic-item ${selectedPath === guideNode.path ? 'active' : ''}`}
              onClick={() => selectNode(guideNode)}
            >
              <span className="material-symbols-outlined rv-wiki-topic-guide-icon">
                menu_book
              </span>
              <span className="rv-wiki-topic-name rv-wiki-topic-guide-title">{root.label}</span>
              <div className="rv-wiki-item-actions" onClick={(e) => e.stopPropagation()}>
                <CopyPathButton
                  panel="wiki-viewer"
                  relativePath={guideNode.pagePath}
                  className="rv-file-page-action"
                  title="Copy wiki guide path"
                />
                <SendToChatButton
                  panel="wiki-viewer"
                  relativePath={guideNode.pagePath}
                  className="rv-file-page-action"
                  title="Send wiki guide path to chat"
                />
              </div>
            </button>
          </div>
          <div className="rv-wiki-topic-divider" role="separator" />

          {root.children.filter((section) => section !== guideNode).map((section) => {
          const isActiveSection = selectedPath === section.path || selectedPath.startsWith(`${section.path}/`);
          const headingArticle = findHeadingArticle(section);
          const isHeadingViewed = headingArticle !== null && selectedPath === headingArticle.path;

          return (
            <div key={section.path} className="rv-wiki-collection-group">
              <div
                className={`rv-wiki-collection-header ${isActiveSection ? 'active' : ''} ${isHeadingViewed ? 'is-selected' : ''} ${headingArticle ? '' : 'is-static'}`}
                onClick={headingArticle ? () => selectNode(headingArticle) : undefined}
              >
                {section.label}
              </div>
              {section.children.filter((article) => article !== headingArticle).map((article) => {
                const isActive = selectedPath === article.path;
                return (
                  <button
                    key={article.path}
                    className={`rv-wiki-topic-item ${isActive ? 'active' : ''}`}
                    onClick={() => selectNode(article)}
                  >
                    <span className="rv-wiki-topic-indicator">
                      {isActive ? '\u25C9' : '\u25CB'}
                    </span>
                    <span className="rv-wiki-topic-name">{article.label}</span>
                    <div className="rv-wiki-item-actions" onClick={(e) => e.stopPropagation()}>
                      <CopyPathButton
                        panel="wiki-viewer"
                        relativePath={article.pagePath}
                        className="rv-file-page-action"
                        title="Copy article path"
                      />
                      <SendToChatButton
                        panel="wiki-viewer"
                        relativePath={article.pagePath}
                        className="rv-file-page-action"
                        title="Send article path to chat"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}
