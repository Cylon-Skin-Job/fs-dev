/**
 * @module wikiStore
 * @role State management for the wiki-viewer panel
 * @reads content/index.json, content/{section}/index.json, content/{section}/{article}/{file}.md
 *
 * Folder-driven structure:
 *   content/index.json → sections
 *   content/{section}/index.json → articles
 *   content/{section}/{article}/index.json → groups (right sidebar)
 *   content/{section}/{article}/{Name}_Guide.md → guide markdown
 *   content/{section}/{article}/{group}/{file}.md → article markdown
 */

import { create } from 'zustand';

export interface Section {
  id: string;
  title: string;
}

export interface Article {
  id: string;
  title: string;
  folder: string;
  guide?: string;
}

export interface ArticleRef {
  id: string;
  title: string;
  file: string;
}

export interface ArticleGroup {
  id: string;
  title: string;
  articles: ArticleRef[];
}

interface WikiState {
  // Index data
  sections: Section[];
  articlesBySection: Record<string, Article[]>;
  groupsByArticle: Record<string, ArticleGroup[]>;

  // Navigation
  activeSection: string;
  activeArticle: string;
  activeArticleFile: string; // '' = show guide
  showGuide: boolean;

  // Content
  guideContent: string;
  articleContent: string;
  loading: boolean;
  error: string | null;

  // History (back/forward through articles)
  history: { sectionId: string; articleId: string; file: string }[];
  historyIndex: number;
}

type WikiActions = {
  setIndex: (sections: Section[], articlesBySection: Record<string, Article[]>) => void;
  setArticleGroups: (articleId: string, groups: ArticleGroup[]) => void;
  selectArticle: (sectionId: string, articleId: string, file?: string) => void;
  showArticleGuide: () => void;
  goBack: () => void;
  goForward: () => void;
  setGuideContent: (content: string) => void;
  setArticleContent: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  activateWorkspace: (workspaceId: string | null) => void;
  reset: () => void;
};

type FullWikiState = WikiState & WikiActions;

function createEmptyState(): WikiState {
  return {
    sections: [],
    articlesBySection: {},
    groupsByArticle: {},
    activeSection: '',
    activeArticle: '',
    activeArticleFile: '',
    showGuide: true,
    guideContent: '',
    articleContent: '',
    loading: false,
    error: null,
    history: [],
    historyIndex: -1,
  };
}

export const useWikiStore = create<FullWikiState>((set, get) => ({
  ...createEmptyState(),

  setIndex: (sections, articlesBySection) => {
    const firstWithArticles = sections.find(
      (s) => (articlesBySection[s.id] || []).length > 0
    );
    const defaultSection = firstWithArticles?.id || sections[0]?.id || '';
    const defaultArticle = defaultSection
      ? (articlesBySection[defaultSection] || [])[0]?.id || ''
      : '';

    set({
      sections,
      articlesBySection,
      activeSection: defaultSection,
      activeArticle: defaultArticle,
      activeArticleFile: '',
      showGuide: true,
      guideContent: '',
      articleContent: '',
      loading: false,
      error: null,
      history: defaultArticle
        ? [{ sectionId: defaultSection, articleId: defaultArticle, file: '' }]
        : [],
      historyIndex: defaultArticle ? 0 : -1,
    });
  },

  setArticleGroups: (articleId, groups) =>
    set((state) => ({
      groupsByArticle: { ...state.groupsByArticle, [articleId]: groups },
    })),

  selectArticle: (sectionId, articleId, file = '') => {
    const state = get();
    const newEntry = { sectionId, articleId, file };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newEntry);

    set({
      activeSection: sectionId,
      activeArticle: articleId,
      activeArticleFile: file,
      showGuide: file === '',
      guideContent: file === '' ? '' : state.guideContent,
      articleContent: '',
      loading: true,
      error: null,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  showArticleGuide: () => {
    const state = get();
    if (state.activeArticleFile === '') return;
    const newEntry = {
      sectionId: state.activeSection,
      articleId: state.activeArticle,
      file: '',
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newEntry);

    set({
      activeArticleFile: '',
      showGuide: true,
      articleContent: '',
      loading: true,
      error: null,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  goBack: () => {
    const state = get();
    if (state.historyIndex <= 0) return;
    const newIndex = state.historyIndex - 1;
    const entry = state.history[newIndex];
    set({
      historyIndex: newIndex,
      activeSection: entry.sectionId,
      activeArticle: entry.articleId,
      activeArticleFile: entry.file,
      showGuide: entry.file === '',
      loading: true,
      error: null,
    });
  },

  goForward: () => {
    const state = get();
    if (state.historyIndex >= state.history.length - 1) return;
    const newIndex = state.historyIndex + 1;
    const entry = state.history[newIndex];
    set({
      historyIndex: newIndex,
      activeSection: entry.sectionId,
      activeArticle: entry.articleId,
      activeArticleFile: entry.file,
      showGuide: entry.file === '',
      loading: true,
      error: null,
    });
  },

  setGuideContent: (content) =>
    set({ guideContent: content, loading: false, error: null }),

  setArticleContent: (content) =>
    set({ articleContent: content, loading: false, error: null }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  activateWorkspace: () => {
    // Reset wiki state on workspace switch. Content will be reloaded
    // via usePanelData when the wiki-viewer panel is rendered.
    set(createEmptyState());
  },

  reset: () => set(createEmptyState()),
}));
