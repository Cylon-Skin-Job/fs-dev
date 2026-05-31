/**
 * @module EdgePanel
 * @role Right column — guide header + groups/articles for active article
 * @reads wikiStore: groupsByArticle, activeArticle, activeArticleFile, articlesBySection, activeSection
 */

import { useWikiStore } from '../../state/wikiStore';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

export function EdgePanel() {
  const activeArticle = useWikiStore((s) => s.activeArticle);
  const activeArticleFile = useWikiStore((s) => s.activeArticleFile);
  const activeSection = useWikiStore((s) => s.activeSection);
  const articlesBySection = useWikiStore((s) => s.articlesBySection);
  const groupsByArticle = useWikiStore((s) => s.groupsByArticle);
  const selectArticle = useWikiStore((s) => s.selectArticle);
  const showArticleGuide = useWikiStore((s) => s.showArticleGuide);

  const article = activeSection
    ? (articlesBySection[activeSection] || []).find((a) => a.id === activeArticle)
    : undefined;

  const groups = activeArticle ? (groupsByArticle[activeArticle] || []) : [];

  // Derive guide title from guide filename (e.g., Connectors_Guide.md → "Connectors Guide")
  const guideFile = article ? (article.guide || `${article.id}_Guide.md`) : '';
  const guideTitle = guideFile
    ? guideFile.replace(/\.md$/, '').replace(/_/g, ' ')
    : 'Guide';

  const isGuideActive = activeArticleFile === '';

  const handleGuideClick = () => {
    if (!isGuideActive) showArticleGuide();
  };

  const handleArticleClick = (file: string) => {
    if (!activeSection || !activeArticle) return;
    selectArticle(activeSection, activeArticle, file);
  };

  if (!article) {
    return (
      <div className="rv-wiki-edge-panel">
        <div className="rv-wiki-edge-empty">Select an article</div>
      </div>
    );
  }

  return (
    <div className="rv-wiki-edge-panel">
      {/* Guide header */}
      <button
        className={`rv-wiki-edge-guide-header ${isGuideActive ? 'active' : ''}`}
        onClick={handleGuideClick}
      >
        <span className="material-symbols-outlined">chrome_reader_mode</span>
        <span className="rv-wiki-edge-link-text">{guideTitle}</span>
        {guideFile && activeSection && (
          <div className="rv-wiki-item-actions" onClick={(e) => e.stopPropagation()}>
            <CopyPathButton
              panel="wiki-viewer"
              relativePath={`${activeSection}/${article.folder}/${guideFile}`}
              className="rv-file-page-action"
              title="Copy guide path"
            />
            <SendToChatButton
              panel="wiki-viewer"
              relativePath={`${activeSection}/${article.folder}/${guideFile}`}
              className="rv-file-page-action"
              title="Send guide path to chat"
            />
          </div>
        )}
      </button>

      {/* Groups */}
      {groups.map((group) => (
        <div key={group.id} className="rv-wiki-edge-section">
          <div className="rv-wiki-edge-heading">{group.title}</div>
          {group.articles.map((ref) => {
            const isActive = activeArticleFile === ref.file;
            return (
              <button
                key={ref.id}
                className={`rv-wiki-edge-link ${isActive ? 'active' : ''}`}
                onClick={() => handleArticleClick(ref.file)}
              >
                <span className="rv-wiki-edge-link-text">{ref.title}</span>
                {activeSection && article && (
                  <div className="rv-wiki-item-actions" onClick={(e) => e.stopPropagation()}>
                    <CopyPathButton
                      panel="wiki-viewer"
                      relativePath={`${activeSection}/${article.folder}/${ref.file}`}
                      className="rv-file-page-action"
                      title="Copy article path"
                    />
                    <SendToChatButton
                      panel="wiki-viewer"
                      relativePath={`${activeSection}/${article.folder}/${ref.file}`}
                      className="rv-file-page-action"
                      title="Send article path to chat"
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ))}

      {groups.length === 0 && (
        <div className="rv-wiki-edge-empty">No groups</div>
      )}
    </div>
  );
}
