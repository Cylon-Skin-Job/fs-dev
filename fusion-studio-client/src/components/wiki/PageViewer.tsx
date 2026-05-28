/**
 * @module PageViewer
 * @role Center column — renders guide or article markdown
 * @reads wikiStore: guideContent, articleContent, loading, activeArticle, activeArticleFile, showGuide
 *
 * No tabs, no breadcrumbs. Header shows article name + back/forward nav.
 */

import { useCallback } from 'react';
import { markdownToHtml } from '../../lib/transforms';
import { useWikiStore } from '../../state/wikiStore';

export function PageViewer() {
  const activeArticle = useWikiStore((s) => s.activeArticle);
  const activeArticleFile = useWikiStore((s) => s.activeArticleFile);
  const showGuide = useWikiStore((s) => s.showGuide);
  const guideContent = useWikiStore((s) => s.guideContent);
  const articleContent = useWikiStore((s) => s.articleContent);
  const loading = useWikiStore((s) => s.loading);
  const error = useWikiStore((s) => s.error);
  const historyIndex = useWikiStore((s) => s.historyIndex);
  const history = useWikiStore((s) => s.history);
  const goBack = useWikiStore((s) => s.goBack);
  const goForward = useWikiStore((s) => s.goForward);
  const articlesBySection = useWikiStore((s) => s.articlesBySection);
  const activeSection = useWikiStore((s) => s.activeSection);

  const getArticleTitle = useCallback(() => {
    const articles = articlesBySection[activeSection] || [];
    const article = articles.find((a) => a.id === activeArticle);
    if (!article) return activeArticle;
    if (activeArticleFile === '' || showGuide) return article.title;
    // Derive title from filename for specific files
    const name = activeArticleFile.replace(/\.md$/, '').replace(/_/g, ' ');
    return name;
  }, [articlesBySection, activeSection, activeArticle, activeArticleFile, showGuide]);

  // Intercept wiki-internal links
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    // Only handle relative markdown links
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('/')) return;

    // TODO: resolve internal wiki links to article navigation
    // For now, let them behave as normal links
  }, []);

  if (!activeArticle) {
    return (
      <div className="rv-wiki-page-viewer">
        <div className="rv-wiki-page-empty">
          <span className="material-symbols-outlined">full_coverage</span>
          <p>Select an article to view</p>
        </div>
      </div>
    );
  }

  const rendered = showGuide || activeArticleFile === ''
    ? markdownToHtml(guideContent)
    : markdownToHtml(articleContent);

  return (
    <div className="rv-wiki-page-viewer" onClick={handleContentClick}>
      {/* Header: nav + article name */}
      <div className="rv-wiki-page-nav">
        <button
          className="rv-wiki-nav-btn"
          onClick={goBack}
          disabled={historyIndex <= 0}
          title="Back"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <button
          className="rv-wiki-nav-btn"
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
          title="Forward"
        >
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
        <span className="rv-wiki-breadcrumb">{getArticleTitle()}</span>
      </div>

      {/* Content */}
      {error && (
        <div className="rv-wiki-page-error">
          <span className="material-symbols-outlined rv-icon-md">error</span>
          <span>{error}</span>
        </div>
      )}

      {loading && !rendered && (
        <div className="rv-wiki-page-loading">Loading...</div>
      )}

      <div
        className="rv-wiki-page-content rv-document-surface"
        dangerouslySetInnerHTML={{ __html: rendered as string }}
      />
    </div>
  );
}
