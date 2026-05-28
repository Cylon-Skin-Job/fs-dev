/**
 * @module EdgePanel
 * @role Right column — guide header + groups/articles for active article
 * @reads wikiStore: groupsByArticle, activeArticle, activeArticleFile, articlesBySection, activeSection
 */

import { useWikiStore } from '../../state/wikiStore';

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
  const guideTitle = article
    ? (article.guide || `${article.id}_Guide.md`)
        .replace(/\.md$/, '')
        .replace(/_/g, ' ')
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
        <span>{guideTitle}</span>
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
                {ref.title}
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
