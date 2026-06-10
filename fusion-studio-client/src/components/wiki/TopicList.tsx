/**
 * @module TopicList
 * @role Left sidebar — lists wiki folder-tree nodes and highlights active
 * @reads wikiStore: root, selectedPath
 */

import { useWikiStore } from '../../state/wikiStore';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

export function TopicList() {
  const root = useWikiStore((s) => s.root);
  const selectedPath = useWikiStore((s) => s.selectedPath);
  const selectNode = useWikiStore((s) => s.selectNode);

  if (!root) return null;

  return (
    <div className="rv-wiki-topic-list">
      <div className="rv-wiki-topic-list-items">
        <div className="rv-wiki-collection-group">
          <button
            className={`rv-wiki-topic-item ${selectedPath === root.path ? 'active' : ''}`}
            onClick={() => selectNode(root)}
          >
            <span className="material-symbols-outlined rv-wiki-topic-guide-icon">
              menu_book
            </span>
            <span className="rv-wiki-topic-name rv-wiki-topic-guide-title">{root.label}</span>
            <div className="rv-wiki-item-actions" onClick={(e) => e.stopPropagation()}>
              <CopyPathButton
                panel="wiki-viewer"
                relativePath={root.pagePath}
                className="rv-file-page-action"
                title="Copy wiki guide path"
              />
              <SendToChatButton
                panel="wiki-viewer"
                relativePath={root.pagePath}
                className="rv-file-page-action"
                title="Send wiki guide path to chat"
              />
            </div>
          </button>
        </div>

        {root.children.map((section) => {
          const isActiveSection = selectedPath === section.path || selectedPath.startsWith(`${section.path}/`);

          return (
            <div key={section.path} className="rv-wiki-collection-group">
              <div
                className={`rv-wiki-collection-header ${isActiveSection ? 'active' : ''}`}
                onClick={() => selectNode(section)}
              >
                {section.label}
              </div>
              {section.children.map((article) => {
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
  );
}
