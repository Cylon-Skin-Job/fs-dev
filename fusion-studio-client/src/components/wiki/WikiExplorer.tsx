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

const ROOT_INDEX = 'content/index.json';

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

  // Track which section indices we've loaded
  const loadedSectionsRef = useRef<Set<string>>(new Set());
  // Track which article group indices we've loaded
  const loadedGroupsRef = useRef<Set<string>>(new Set());

  const onIndex = useCallback((content: string) => {
    try {
      const index = JSON.parse(content);
      const sections = index.sections || [];
      setIndex(sections, {}); // articles loaded per-section below
      loadedSectionsRef.current.clear();
      loadedGroupsRef.current.clear();
    } catch {
      setError('Failed to parse wiki index');
    }
  }, [setIndex, setError]);

  const onFileContent = useCallback((path: string, content: string) => {
    if (path === ROOT_INDEX) {
      // Already handled by onIndex
      return;
    }

    // Section index: content/{section}/index.json
    const sectionMatch = path.match(/^content\/([^/]+)\/index\.json$/);
    if (sectionMatch) {
      try {
        const idx = JSON.parse(content);
        const sectionId = sectionMatch[1];
        const articles = idx.articles || [];
        useWikiStore.setState((state) => ({
          articlesBySection: { ...state.articlesBySection, [sectionId]: articles },
        }));
        loadedSectionsRef.current.add(sectionId);
      } catch {
        /* ignore parse errors */
      }
      return;
    }

    // Article group index: content/{section}/{article}/index.json
    const groupMatch = path.match(/^content\/([^/]+)\/([^/]+)\/index\.json$/);
    if (groupMatch) {
      try {
        const idx = JSON.parse(content);
        const articleId = groupMatch[2];
        const groups = idx.groups || [];
        setArticleGroups(articleId, groups);
        loadedGroupsRef.current.add(articleId);
      } catch {
        /* ignore parse errors */
      }
      return;
    }

    // Markdown content: content/{section}/{article}/{file}.md
    const mdMatch = path.match(/^content\/([^/]+)\/([^/]+)\/(.+\.md)$/);
    if (mdMatch) {
      const fileName = mdMatch[3];
      const article = useWikiStore.getState().activeArticle;
      const section = useWikiStore.getState().activeSection;
      const file = useWikiStore.getState().activeArticleFile;

      // Only accept if this content matches current selection
      if (mdMatch[1] !== section || mdMatch[2] !== article) return;

      if (file === '' || file === fileName) {
        // Guide file
        setGuideContent(content);
      } else if (file === fileName) {
        // Specific article file
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

  // Re-request root index when workspace switches
  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    request(ROOT_INDEX);
  }, [activeWorkspaceId, ws, request]);

  // Load section indices when sections are known
  useEffect(() => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    for (const section of sections) {
      if (loadedSectionsRef.current.has(section.id)) continue;
      request(`content/${section.id}/index.json`);
    }
  }, [sections, ws, request]);

  // Load article groups when active article changes
  useEffect(() => {
    if (!activeArticle || !activeSection) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (loadedGroupsRef.current.has(activeArticle)) return;

    const article = articlesBySection[activeSection]?.find(
      (a) => a.id === activeArticle
    );
    if (!article) return;

    request(`content/${activeSection}/${article.folder}/index.json`);
  }, [activeArticle, activeSection, articlesBySection, ws, request]);

  // Load markdown content when selection changes
  useEffect(() => {
    if (!activeArticle || !activeSection) return;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const article = articlesBySection[activeSection]?.find(
      (a) => a.id === activeArticle
    );
    if (!article) return;

    setLoading(true);

    if (showGuide || activeArticleFile === '') {
      // Load guide file
      const guideFile = article.guide || `${article.id}_Guide.md`;
      request(`content/${activeSection}/${article.folder}/${guideFile}`);
    } else {
      // Load specific article file
      request(`content/${activeSection}/${article.folder}/${activeArticleFile}`);
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
