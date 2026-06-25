/**
 * wiki-viewer.js — Core wiki rendering engine
 *
 * Loads markdown content, renders sidebars from nested folders,
 * manages history, and renders detail panels.
 *
 * Used by: wiki-guide, wiki-viewer iframe apps
 */

(function (global) {
  'use strict';

  const WikiViewer = {
    // ── State ──
    caches: {
      user: {},    // { [sectionId]: markdownBody }
      item: {},    // { [sectionId/itemId]: markdownBody }
      article: {}, // { [path]: markdownBody }
    },
    history: [],
    historyIndex: -1,

    // ── Helpers ──
    escapeHtml(str) {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    stripFrontMatter(md) {
      if (!md || !md.startsWith('---')) return md;
      const end = md.indexOf('---', 3);
      if (end === -1) return md;
      return md.slice(end + 3).trim();
    },

    // ── Content Loading ──
    async loadJson(url) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
      } catch (e) {
        console.warn('[WikiViewer] Failed to load JSON:', url, e.message);
        return null;
      }
    },

    async loadMarkdown(url, cache, key) {
      if (cache[key]) return cache[key];
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        cache[key] = this.stripFrontMatter(text);
        return cache[key];
      } catch (e) {
        console.warn('[WikiViewer] Failed to load markdown:', url, e.message);
        return null;
      }
    },

    async loadArticle(basePath, articlePath) {
      const url = `${basePath}/${articlePath}`;
      return this.loadMarkdown(url, this.caches.article, articlePath);
    },

    async loadGuide(basePath, wikiFile) {
      const url = `${basePath}/${wikiFile}`;
      const sectionId = basePath.split('/').pop();
      return this.loadMarkdown(url, this.caches.user, sectionId);
    },

    async loadItem(basePath, sectionId, itemId) {
      const url = `${basePath}/${itemId}.md`;
      return this.loadMarkdown(url, this.caches.item, `${sectionId}/${itemId}`);
    },

    // ── History ──
    push(entry) {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push({ ...entry });
      this.historyIndex++;
      this.emit('history:changed', { canGoBack: this.canGoBack(), canGoForward: this.canGoForward() });
    },

    canGoBack() {
      return this.historyIndex > 0;
    },

    canGoForward() {
      return this.historyIndex < this.history.length - 1;
    },

    goBack() {
      if (!this.canGoBack()) return null;
      this.historyIndex--;
      return this.current();
    },

    goForward() {
      if (!this.canGoForward()) return null;
      this.historyIndex++;
      return this.current();
    },

    current() {
      return this.history[this.historyIndex] || null;
    },

    // ── Sidebar Generation ──
    // Scans nested folder structure and returns groups with articles
    async scanContentFolder(basePath) {
      const index = await this.loadJson(`${basePath}/index.json`);
      if (index && index.groups) {
        return index.groups;
      }
      // Fallback: scan filesystem
      try {
        const res = await fetch(`${basePath}/`);
        if (!res.ok) return [];
        // This would need server-side directory listing
        // For now, return empty — index.json is the source of truth
        return [];
      } catch {
        return [];
      }
    },

    // ── Rendering ──
    renderSidebar(container, groups, options = {}) {
      const { activeArticle, onSelect } = options;
      let html = '';

      if (groups && groups.length > 0) {
        groups.forEach(group => {
          html += `<div class="wiki-sidebar-section-title">${this.escapeHtml(group.title)}</div>`;
          (group.articles || []).forEach(article => {
            const isActive = activeArticle === article.file;
            html += `<a class="wiki-sidebar-link ${isActive ? 'active' : ''}" data-article-file="${this.escapeHtml(article.file)}">${this.escapeHtml(article.title)}</a>`;
          });
        });
      }

      container.innerHTML = html;

      // Wire clicks
      container.querySelectorAll('.wiki-sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
          if (onSelect && link.dataset.articleFile) {
            onSelect(link.dataset.articleFile);
          }
        });
      });
    },

    renderDetail(container, markdown, options = {}) {
      const { title, path, onCopyPath } = options;
      const html = marked.parse(markdown || '# No content\n\nNo details available.');

      let headerHtml = '';
      if (title) {
        headerHtml += `<div class="wiki-detail-title">${this.escapeHtml(title)}</div>`;
      }
      if (path) {
        headerHtml += `<div class="wiki-detail-path-row">
          <span class="wiki-detail-path">${this.escapeHtml(path)}</span>
          ${onCopyPath ? `<button class="wiki-detail-copy" title="Copy path">content_copy</button>` : ''}
        </div>`;
      }

      container.innerHTML = `
        <div class="wiki-detail-header">${headerHtml}</div>
        <div class="wiki-detail-scroll"><div class="wiki-detail-content">${html}</div></div>
      `;

      // Wire copy button
      if (onCopyPath) {
        const copyBtn = container.querySelector('.wiki-detail-copy');
        if (copyBtn) {
          copyBtn.addEventListener('click', () => onCopyPath(path));
        }
      }
    },

    renderEmpty(container, options = {}) {
      const { icon, title, description } = options;
      container.innerHTML = `
        <div class="wiki-detail-empty">
          <span class="material-symbols-outlined">${icon || 'article'}</span>
          <div style="font-size:1rem;font-weight:600;margin-bottom:8px;">${this.escapeHtml(title || 'Wiki')}</div>
          <div style="font-size:0.875rem;">${this.escapeHtml(description || 'Select an item to view details.')}</div>
        </div>
      `;
    },

    // ── Events ──
    listeners: {},
    on(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    },
    off(event, handler) {
      if (!this.listeners[event]) return;
      this.listeners[event] = this.listeners[event].filter(h => h !== handler);
    },
    emit(event, data) {
      (this.listeners[event] || []).forEach(h => h(data));
    },
  };

  // Expose
  global.WikiViewer = WikiViewer;
})(window);
