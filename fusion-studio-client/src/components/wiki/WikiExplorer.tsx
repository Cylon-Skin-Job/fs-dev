/**
 * @module WikiExplorer
 * @role Top-level wiki-viewer panel component — three-column layout
 * @reads wikiStore: sections, articlesBySection, activeSection, activeArticle
 *
 * Renders: TopicList (left) | PageViewer (center) | EdgePanel (right)
 * Loads folder-driven structure: content/index.json → sections → articles → groups
 */

import { useCallback, useEffect, useRef } from 'react';
import { usePanelData } from '../../hooks/usePanelData';
import { useViewLayoutStyles } from '../../hooks/useSharedWorkspaceStyles';
import { usePanelStore } from '../../state/panelStore';
import { useWikiStore } from '../../state/wikiStore';
import { TopicList } from './TopicList';
import { PageViewer } from './PageViewer';
import { EdgePanel } from './EdgePanel';

const ROOT_INDEX = 'index.json';

export function WikiExplorer() {
  useViewLayoutStyles('wiki-viewer');
  const ws = usePanelStore((s) => s.ws);
  const activeWorkspaceId = usePanelStore((s) => s.activeWorkspaceId);

  const sections = useWikiStore((s) => s.sections);
  const articlesBySection = useWikiStore((s) => s.articlesBySection);
  const activeSection = useWikiStore((s) => s.activeSection);
  const activeArticle = useWikiStore((s) => s.activeArticle);
  const activeArticleFile = useWikiStore((s) => s.activeArticleFile);
  const showGuide = useWikiStore((s) => s.showGuide);
  const setIndex = useWikiStore((s) => s.setIndex);
  const setArticleGroups = useWikiStore((s) => s.setArticleGroups);
  const setGuideContent = useWikiStore((s) => s.setGuideContent);
  const setArticleContent = useWikiStore((s) => s.setArticleContent);
  const setLoading = useWikiStore((s) => s.setLoading);
  const setError = useWikiStore((s) => s.setError);

  const loadedSectionsRef = useRef<Set<string>>(new Set());

  const onIndex = useCallback((content: string) => {
    try {
      const index = JSON.parse(content);
      const sections = index.sections || [];
      setIndex(sections, {});
      loadedSectionsRef.current.clear();
    } catch {
      setError('Failed to parse wiki index');
    }
  }, [setIndex, setError]);

  const onFileContent = useCallback((path: string, content: string) => {
    if (path === ROOT_INDEX) return;

    const sectionMatch = path.match(/^([^/]+)\/index\.json$/);
    if (sectionMatch) {
      try {
        const idx = JSON.parse(content);
        const sectionId = sectionMatch[1];
        const articles = idx.articles || [];
        useWikiStore.setState((state) => ({
          articlesBySection: { ...state.articlesBySection, [sectionId]: articles },
        }));
        loadedSectionsRef.current.add(sectionId);
      } catch {}
      return;
    }

    const groupMatch = path.match(/^([^/]+)\/([^/]+)\/index\.json$/);
    if (groupMatch) {
      try {
        const idx = JSON.parse(content);
        const sectionId = groupMatch[1];
        const folderName = groupMatch[2];
        // Read fresh from the store: this callback is memoized without
        // articlesBySection in its deps, so the closure value is the empty
        // initial state. Using it meant the lookup always failed and groups
        // were keyed by folderName instead of the article id — which only
        // broke articles whose folder name != id (e.g. Coding-CLIs).
        const article = useWikiStore.getState().articlesBySection[sectionId]?.find(
          (a) => a.folder === folderName || a.id === folderName
        );
        const articleId = article?.id || folderName;
        setArticleGroups(articleId, idx.groups || []);
      } catch {}
      return;
    }

    const mdMatch = path.match(/^([^/]+)\/([^/]+)\/(.+\.md)$/);
    if (mdMatch) {
      const fileName = mdMatch[3];
      const article = useWikiStore.getState().activeArticle;
      const section = useWikiStore.getState().activeSection;
      const file = useWikiStore.getState().activeArticleFile;

      const articles = useWikiStore.getState().articlesBySection[section] || [];
      const articleMeta = articles.find((a) => a.id === article);
      const expectedFolder = articleMeta?.folder || article;
      if (mdMatch[1] !== section || mdMatch[2] !== expectedFolder) return;

      if (file === '') {
        setGuideContent(content);
      } else if (file === fileName) {
        setArticleContent(content);
      }
      return;
    }
  }, [setArticleGroups, setGuideContent, setArticleContent]);

  const onError = useCallback((error: string) => {
    setError(error);
  }, [setError]);

  const { request } = usePanelData({
    panel: 'wiki-viewer',
    indexPath: ROOT_INDEX,
    onIndex,
    onFileContent,
    onError,
  });

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    request(ROOT_INDEX);
  }, [activeWorkspaceId, ws, request]);

  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    for (const section of sections) {
      if (loadedSectionsRef.current.has(section.id)) continue;
      request(`${section.id}/index.json`);
    }
  }, [sections, ws, request]);

  useEffect(() => {
    if (!activeArticle || !activeSection) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const article = articlesBySection[activeSection]?.find(
      (a) => a.id === activeArticle
    );
    if (!article) return;

    request(`${activeSection}/${article.folder}/index.json`);
  }, [activeArticle, activeSection, articlesBySection, ws, request]);

  useEffect(() => {
    if (!activeArticle || !activeSection) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const article = articlesBySection[activeSection]?.find(
      (a) => a.id === activeArticle
    );
    if (!article) return;

    setLoading(true);

    if (showGuide || activeArticleFile === '') {
      const guideFile = article.guide || `${article.id}_Guide.md`;
      request(`${activeSection}/${article.folder}/${guideFile}`);
    } else {
      request(`${activeSection}/${article.folder}/${activeArticleFile}`);
    }
  }, [activeArticle, activeSection, activeArticleFile, showGuide, articlesBySection, ws, request, setLoading]);

  const indexLoaded = sections.length > 0;

  if (!indexLoaded) {
    return (
      <div className="rv-wiki-explorer">
        <div className="rv-wiki-loading">
          <span className="rv-dim-label">Loading wiki...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rv-wiki-explorer">
      <TopicList />
      <PageViewer />
      <EdgePanel />
    </div>
  );
}
