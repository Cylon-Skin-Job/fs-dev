// Wiki Viewer — folder-driven wiki with auto-discovered structure
// Loads section metadata from content/index.json and article groups
// from per-article index.json files.

(function () {
  'use strict';

  // ── State ──
  let sections = [];
  let articlesBySection = {};
  let activeSection = '';
  let activeArticle = '';
  let activeArticleFile = '';
  let showGuide = true;

  const caches = {
    guide: {},    // { [section/article]: markdown }
    article: {},  // { [path]: markdown }
  };

  // ── DOM refs ──
  const leftPanel = document.getElementById('left-panel');
  const detailScroll = document.getElementById('detail-scroll');
  const detailHeader = document.getElementById('detail-header');
  const detailTitle = document.getElementById('detail-title');
  const sidebarScroll = document.getElementById('sidebar-scroll');
  const backBtn = document.getElementById('nav-back');
  const forwardBtn = document.getElementById('nav-forward');

  // ── Helpers ──
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function stripFrontMatter(md) {
    if (!md || !md.startsWith('---')) return md;
    const end = md.indexOf('---', 3);
    if (end === -1) return md;
    return md.slice(end + 3).trim();
  }

  // ── Content Loading ──
  async function loadJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[WikiViewer] Failed to load JSON:', url, e.message);
      return null;
    }
  }

  async function loadMarkdown(url, cache, key) {
    if (cache[key]) return cache[key];
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      cache[key] = stripFrontMatter(text);
      return cache[key];
    } catch (e) {
      console.warn('[WikiViewer] Failed to load markdown:', url, e.message);
      return null;
    }
  }

  // ── Init ──
  async function init() {
    const rootIndex = await loadJson('../content/index.json');
    if (!rootIndex || !rootIndex.sections) {
      leftPanel.innerHTML = '<div class="wiki-empty">No content found</div>';
      return;
    }

    sections = rootIndex.sections;

    // Load article lists for each section
    for (const section of sections) {
      const idx = await loadJson(`../content/${section.id}/index.json`);
      articlesBySection[section.id] = (idx && idx.articles) || [];
    }

    // Default to first section with articles, or first section
    const firstWithArticles = sections.find(s => (articlesBySection[s.id] || []).length > 0);
    activeSection = firstWithArticles ? firstWithArticles.id : sections[0]?.id;
    activeArticle = '';
    showGuide = true;

    renderLeftPanel();
    renderDetail();
    renderRightSidebar();
    updateNavButtons();
  }

  // ── Left Panel ──
  function renderLeftPanel() {
    let html = '';

    sections.forEach(section => {
      const articles = articlesBySection[section.id] || [];
      const isSectionActive = activeSection === section.id;

      html += `<div class="wiki-section-heading ${isSectionActive ? 'active' : ''}" data-section="${escapeHtml(section.id)}">${escapeHtml(section.title)}</div>`;

      articles.forEach(article => {
        const isActive = activeSection === section.id && activeArticle === article.id && showGuide;
        html += `<a class="wiki-article-link ${isActive ? 'active' : ''}" data-section="${escapeHtml(section.id)}" data-article="${escapeHtml(article.id)}">${escapeHtml(article.title)}</a>`;
      });
    });

    leftPanel.innerHTML = html;

    leftPanel.querySelectorAll('.wiki-section-heading').forEach(el => {
      el.addEventListener('click', () => {
        const sectionId = el.dataset.section;
        if (sectionId !== activeSection) {
          activeSection = sectionId;
          activeArticle = '';
          showGuide = true;
          activeArticleFile = '';
          renderLeftPanel();
          renderDetail();
          renderRightSidebar();
        }
      });
    });

    leftPanel.querySelectorAll('.wiki-article-link').forEach(el => {
      el.addEventListener('click', () => {
        const sectionId = el.dataset.section;
        const articleId = el.dataset.article;
        activeSection = sectionId;
        activeArticle = articleId;
        showGuide = true;
        activeArticleFile = '';
        renderLeftPanel();
        renderDetail();
        renderRightSidebar();
      });
    });
  }

  // ── Detail Panel ──
  async function renderDetail() {
    const article = getActiveArticle();
    if (!article) {
      renderEmpty();
      return;
    }

    const basePath = `../content/${activeSection}/${article.folder}`;

    if (activeArticleFile) {
      // Showing a specific article from the right sidebar
      const md = await loadMarkdown(`${basePath}/${activeArticleFile}`, caches.article, activeArticleFile);
      if (md) {
        const title = getArticleTitle(activeArticleFile) || article.title;
        detailTitle.innerHTML = `<span style="color:var(--text);">${escapeHtml(activeSection)}</span> <span style="color:var(--text);">&gt;</span> <span style="color:var(--text);">${escapeHtml(title)}</span>`;
        detailScroll.innerHTML = `<div class="wiki-detail-content">${marked.parse(md)}</div>`;
        detailHeader.classList.remove('hidden');
      } else {
        detailScroll.innerHTML = '<div class="wiki-detail-empty">Article not found</div>';
      }
      return;
    }

    // Showing the guide
    const guideFile = `${article.id}_guide.md`;
    const guideMd = await loadMarkdown(`${basePath}/${guideFile}`, caches.guide, `${activeSection}/${article.id}`);

    if (guideMd) {
      detailTitle.innerHTML = `<span style="color:var(--text);">${escapeHtml(activeSection)}</span> <span style="color:var(--text);">&gt;</span> <span style="color:var(--text);">${escapeHtml(article.title)}</span>`;
      detailScroll.innerHTML = `<div class="wiki-detail-content">${marked.parse(guideMd)}</div>`;
      detailHeader.classList.remove('hidden');
    } else {
      renderEmpty();
    }
  }

  function renderEmpty() {
    const section = sections.find(s => s.id === activeSection);
    detailTitle.textContent = section ? section.title : 'Wiki';
    detailScroll.innerHTML = `
      <div class="wiki-detail-empty">
        <span class="material-symbols-outlined">article</span>
        <div style="font-size:1rem;font-weight:600;margin-bottom:8px;">${escapeHtml(section ? section.title : 'Wiki')}</div>
        <div style="font-size:0.875rem;">Select an article to view details.</div>
      </div>
    `;
    detailHeader.classList.remove('hidden');
  }

  // ── Right Sidebar ──
  async function renderRightSidebar() {
    const article = getActiveArticle();
    if (!article) {
      sidebarScroll.innerHTML = '';
      return;
    }

    const basePath = `../content/${activeSection}/${article.folder}`;
    const index = await loadJson(`${basePath}/index.json`);
    const groups = (index && index.groups) || [];

    let html = '';

    // Guide header
    const guideTitle = article.title + ' Guide';
    html += `<div class="wiki-sidebar-guide-header ${showGuide && !activeArticleFile ? 'active' : ''}" data-guide="true">
      <span class="material-symbols-outlined">chrome_reader_mode</span>
      <span>${escapeHtml(guideTitle)}</span>
    </div>`;

    // Groups and articles
    groups.forEach(group => {
      html += `<div class="wiki-sidebar-section-title">${escapeHtml(group.title)}</div>`;
      (group.articles || []).forEach(art => {
        const isActive = activeArticleFile === art.file;
        html += `<a class="wiki-sidebar-link ${isActive ? 'active' : ''}" data-file="${escapeHtml(art.file)}">${escapeHtml(art.title)}</a>`;
      });
    });

    sidebarScroll.innerHTML = html;

    // Wire clicks
    const guideHeader = sidebarScroll.querySelector('.wiki-sidebar-guide-header');
    if (guideHeader) {
      guideHeader.addEventListener('click', () => {
        showGuide = true;
        activeArticleFile = '';
        renderDetail();
        renderRightSidebar();
        renderLeftPanel(); // update highlight
      });
    }

    sidebarScroll.querySelectorAll('.wiki-sidebar-link').forEach(link => {
      link.addEventListener('click', () => {
        activeArticleFile = link.dataset.file;
        showGuide = false;
        renderDetail();
        renderRightSidebar();
        renderLeftPanel(); // keep parent highlighted
      });
    });
  }

  // ── Lookup helpers ──
  function getActiveArticle() {
    const articles = articlesBySection[activeSection] || [];
    return articles.find(a => a.id === activeArticle) || articles[0] || null;
  }

  function getArticleTitle(filePath) {
    const article = getActiveArticle();
    if (!article) return null;
    const basePath = `../content/${activeSection}/${article.folder}`;
    // We need to look up the title from the groups
    // This is async, but for simplicity we'll return the filename
    return null;
  }

  // ── Nav buttons (placeholder for future history) ──
  function updateNavButtons() {
    backBtn.disabled = true;
    forwardBtn.disabled = true;
  }

  // ── Start ──
  init();
})();
