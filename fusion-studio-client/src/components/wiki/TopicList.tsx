/**
 * @module TopicList
 * @role Left sidebar — lists wiki sections and articles, highlights active
 * @reads wikiStore: sections, articlesBySection, activeSection, activeArticle
 */

import { useWikiStore } from '../../state/wikiStore';

export function TopicList() {
  const sections = useWikiStore((s) => s.sections);
  const articlesBySection = useWikiStore((s) => s.articlesBySection);
  const activeSection = useWikiStore((s) => s.activeSection);
  const activeArticle = useWikiStore((s) => s.activeArticle);
  const selectArticle = useWikiStore((s) => s.selectArticle);

  const handleSectionClick = (sectionId: string) => {
    const articles = articlesBySection[sectionId] || [];
    if (articles.length > 0 && activeSection !== sectionId) {
      selectArticle(sectionId, articles[0].id);
    }
  };

  const handleArticleClick = (sectionId: string, articleId: string) => {
    selectArticle(sectionId, articleId);
  };

  return (
    <div className="rv-wiki-topic-list">
      <div className="rv-wiki-topic-list-items">
        {sections.map((section) => {
          const articles = articlesBySection[section.id] || [];
          const isActiveSection = section.id === activeSection;

          return (
            <div key={section.id} className="rv-wiki-collection-group">
              <div
                className={`rv-wiki-collection-header ${isActiveSection ? 'active' : ''}`}
                onClick={() => handleSectionClick(section.id)}
                style={{ cursor: articles.length > 0 ? 'pointer' : 'default' }}
              >
                {section.title}
              </div>
              {articles.map((article) => {
                const isActive = isActiveSection && article.id === activeArticle;
                return (
                  <button
                    key={article.id}
                    className={`rv-wiki-topic-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleArticleClick(section.id, article.id)}
                  >
                    <span className="rv-wiki-topic-indicator">
                      {isActive ? '\u25C9' : '\u25CB'}
                    </span>
                    <span className="rv-wiki-topic-name">{article.title}</span>
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
