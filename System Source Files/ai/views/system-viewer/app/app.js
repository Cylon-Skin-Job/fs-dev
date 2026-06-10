// System Viewer — self-contained view
// Loads section metadata and markdown from content/ directory.

(function () {
  'use strict';

  // ── Hardcoded items (functional UI elements not yet in markdown) ──
  const HARDCODED_ITEMS = {
    connectors: [
      {
        id: 'mail',
        name: 'Apple Mail',
        icon: 'mail',
        description: 'Sync email metadata and drafts via Envelope Index + AppleScript.',
        section: 'MacOS Connectors',
        status: 'gray',
        enabled: false,
        detail: `# Apple Mail

**Read path:** SQLite Envelope Index (\`~/Library/Mail/V10/MailData/Envelope Index\`)
**Write path:** AppleScript (drafts only)
**Permission:** Full Disk Access

The Mail connector reads your Apple Mail metadata directly from the Envelope Index SQLite database. This is 1,400× faster than AppleScript for bulk reads.

For creating drafts, it uses AppleScript — the only safe way to write to Mail.app.

**Status indicators:**
- Gray = Off
- Yellow = Syncing
- Green = Connected
- Red = Error (check permissions)`,
      },
      {
        id: 'calendar',
        name: 'Apple Calendar',
        icon: 'calendar_month',
        description: 'Sync calendar events via EventKit or direct SQLite.',
        section: 'MacOS Connectors',
        status: 'gray',
        enabled: false,
        detail: `# Apple Calendar

**Read path:** EventKit API (recommended) or direct SQLite
**Write path:** EventKit API
**Permission:** Calendar TCC

The Calendar connector uses Apple's EventKit framework for safe, sync-aware access to your calendars. It handles iCloud, Google, and Exchange calendars correctly.

**Status indicators:**
- Gray = Off
- Yellow = Syncing
- Green = Connected
- Red = Error`,
      },
      {
        id: 'notes',
        name: 'Apple Notes',
        icon: 'note_stack',
        description: 'Sync notes via AppleScript. Direct SQLite body is proprietary blob.',
        section: 'MacOS Connectors',
        status: 'gray',
        enabled: false,
        detail: `# Apple Notes

**Read path:** AppleScript (recommended)
**Write path:** AppleScript
**Permission:** Automation TCC (AppleEvents)

The Notes connector uses AppleScript to read note content. Direct SQLite access is possible for metadata, but the note body lives in a gzip-compressed proprietary binary blob that changes between MacOS versions.

AppleScript returns clean text/HTML and is the stable choice.

**Status indicators:**
- Gray = Off
- Yellow = Syncing
- Green = Connected
- Red = Error`,
      },
      {
        id: 'reminders',
        name: 'Apple Reminders',
        icon: 'task_alt',
        description: 'Sync reminders via EventKit. Direct SQLite bypasses iCloud sync.',
        section: 'MacOS Connectors',
        status: 'gray',
        enabled: false,
        detail: `# Apple Reminders

**Read path:** EventKit API (recommended)
**Write path:** EventKit API
**Permission:** Reminders TCC

The Reminders connector uses Apple's EventKit framework. This is the only sync-safe approach — direct SQLite bypasses iCloud sync and risks corruption.

EventKit is also ~3,000× faster than AppleScript.

**Status indicators:**
- Gray = Off
- Yellow = Syncing
- Green = Connected
- Red = Error`,
      },
      {
        id: 'gmail',
        name: 'Gmail',
        icon: 'mail',
        description: 'Send and receive email through your Google account.',
        section: 'Google OAuth',
        status: 'gray',
        enabled: false,
        comingSoon: true,
        detail: `# Gmail

**Provider:** Google OAuth
**Status:** Coming soon

The Gmail connector will use OAuth to access your Google account. You will sign in through Google's own prompt and choose exactly what Fusion Studio is allowed to access.`,
      },
      {
        id: 'google-calendar',
        name: 'Google Calendar',
        icon: 'calendar_month',
        description: 'Read and create events through Google Calendar.',
        section: 'Google OAuth',
        status: 'gray',
        enabled: false,
        comingSoon: true,
        detail: `# Google Calendar

**Provider:** Google OAuth
**Status:** Coming soon

The Google Calendar connector will use OAuth to access your Google account. You will sign in through Google's own prompt and choose exactly what Fusion Studio is allowed to access.`,
      },
      {
        id: 'google-tasks',
        name: 'Google Tasks',
        icon: 'task_alt',
        description: 'Read and create tasks through Google Tasks.',
        section: 'Google OAuth',
        status: 'gray',
        enabled: false,
        comingSoon: true,
        detail: `# Google Tasks

**Provider:** Google OAuth
**Status:** Coming soon

The Google Tasks connector will use OAuth to access your Google account. You will sign in through Google's own prompt and choose exactly what Fusion Studio is allowed to access.`,
      },
      {
        id: 'slack',
        name: 'Slack',
        icon: 'chat',
        description: 'Send messages, read channels, and receive notifications.',
        section: 'Slack',
        status: 'gray',
        enabled: false,
        comingSoon: true,
        detail: `# Slack

**Provider:** Slack OAuth
**Status:** Coming soon

The Slack connector will use OAuth to connect to your Slack workspace. Once connected, Fusion Studio workspaces can post updates, receive commands, or alert you when something needs attention.`,
      },
    ],
    secrets: [
      {
        id: 'github',
        name: 'GitHub',
        icon: 'code',
        description: 'Personal access token for GitHub API access.',
        section: 'Inactive',
        detail: `# GitHub

**Setup style:** Manual API token or future OAuth

GitHub can use either a personal access token or an OAuth app flow. A manual token template is simpler for local scripts and agent tools.

Possible secret name:

- \`GITHUB_TOKEN\`

Use least-privilege scopes for the specific task.`,
      },
      {
        id: 'gitlab',
        name: 'GitLab',
        icon: 'merge',
        description: 'Personal access token for GitLab wiki, issues, and API calls.',
        section: 'Inactive',
        detail: `# GitLab

**Setup style:** Manual API token

GitLab already follows the Secrets Manager pattern for local API access.

Expected secret name:

- \`GITLAB_TOKEN\`

The app stores the token value securely and exposes only the name/fingerprint in UI metadata.`,
      },
    ],
    skills: [
      { id: 'skill-1', name: 'Code Review', icon: 'rate_review', description: 'Review code changes with inline comments.', section: '', detail: '## Code Review\n\nAnalyzes diffs and provides structured feedback.' },
      { id: 'skill-2', name: 'Documentation', icon: 'menu_book', description: 'Generate and update docs from source.', section: '', detail: '## Documentation\n\nReads code and writes markdown docs.' },
      { id: 'skill-3', name: 'Refactoring', icon: 'autorenew', description: 'Restructure code while preserving behavior.', section: '', detail: '## Refactoring\n\nSuggests and applies safe refactors.' },
    ],
    triggers: [
      { id: 'trig-1', name: 'On File Change', icon: 'monitoring', description: 'Fire when files matching a pattern change.', section: '', detail: '## On File Change\n\nWatches the workspace with chokidar.' },
      { id: 'trig-2', name: 'On Schedule', icon: 'schedule', description: 'Run tasks at specified intervals.', section: '', detail: '## On Schedule\n\nCron-like scheduling for automations.' },
    ],
    scripts: [
      { id: 'script-1', name: 'Backup Workspace', icon: 'backup', description: 'Create a timestamped backup of the workspace.', section: '', detail: '## Backup Workspace\n\nCopies the workspace to a backup folder.' },
      { id: 'script-2', name: 'Clean Build', icon: 'mop', description: 'Remove build artifacts and reinstall dependencies.', section: '', detail: '## Clean Build\n\nRemoves node_modules, dist, and rebuilds.' },
    ],
    hooks: [
      { id: 'hook-1', name: 'Kimi CLI', icon: 'terminal', description: 'Kimi Code CLI integration.', section: '', detail: '## Kimi CLI\n\nConnects to Kimi Code for AI assistance.' },
      { id: 'hook-2', name: 'Claude CLI', icon: 'terminal', description: 'Claude Code CLI integration.', section: '', detail: '## Claude CLI\n\nConnects to Claude Code for AI assistance.' },
      { id: 'hook-3', name: 'Codex CLI', icon: 'terminal', description: 'OpenAI Codex CLI integration.', section: '', detail: '## Codex CLI\n\nConnects to OpenAI Codex for AI assistance.' },
    ],
  };

  const ICON_MAP = {
    connectors: 'linked_services',
    secrets: 'key',
    skills: 'psychology',
    triggers: 'bolt',
    scripts: 'code',
    hooks: 'link',
  };

  // ── Dynamic state ──
  let TABS = {};
  let SECTIONS = [];
  const USER_CONTENT = {}; // { [sectionId]: markdownBody }
  const ITEM_CONTENT = {}; // { [sectionId/itemId]: markdownBody }
  const ARTICLE_CONTENT = {}; // { [path]: markdownBody }
  let activeTab = '';
  let selectedItemId = '';
  let showGuide = true;
  let selectedArticleFile = ''; // e.g. 'MacOS_Connectors/mail.md'

  // ── DOM refs ──
  const tabBar = document.getElementById('tab-bar');
  const tabTitle = document.getElementById('tab-title');
  const tabDesc = document.getElementById('tab-desc');
  const settingsList = document.getElementById('settings-list');
  const detailScroll = document.getElementById('detail-scroll');
  const detailHeader = document.getElementById('detail-header');
  const sidebarScroll = document.getElementById('sidebar-scroll');
  const detailTitle = document.getElementById('detail-title');
  const detailPath = document.createElement('span'); // hidden path storage
  detailPath.style.display = 'none';
  document.body.appendChild(detailPath);
  const detailCopy = document.getElementById('detail-copy');
  const backBtn = document.getElementById('nav-back');
  const forwardBtn = document.getElementById('nav-forward');


  // ── Helpers ──
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function stripFrontMatter(md) {
    if (!md.startsWith('---')) return md;
    const end = md.indexOf('---', 3);
    if (end === -1) return md;
    return md.slice(end + 3).trim();
  }

  // ── Content loading ──
  async function loadContentIndex() {
    try {
      const res = await fetch('../content/index.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      console.warn('[SystemViewer] Failed to load content/index.json:', e.message);
      return null;
    }
  }

  function getWikiFile(sectionId) {
    const section = SECTIONS.find(s => s.id === sectionId);
    return section?.wiki || 'user.md';
  }

  async function loadUserMarkdown(sectionId) {
    if (USER_CONTENT[sectionId]) return USER_CONTENT[sectionId];
    const wikiFile = getWikiFile(sectionId);
    try {
      const res = await fetch(`../content/${sectionId}/${wikiFile}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      USER_CONTENT[sectionId] = stripFrontMatter(text);
      return USER_CONTENT[sectionId];
    } catch (e) {
      console.warn(`[SystemViewer] Failed to load ${sectionId}/${wikiFile}:`, e.message);
      return null;
    }
  }

  async function loadItemMarkdown(sectionId, itemId) {
    const key = `${sectionId}/${itemId}`;
    if (ITEM_CONTENT[key]) return ITEM_CONTENT[key];
    try {
      const res = await fetch(`../content/${sectionId}/${itemId}.md`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      ITEM_CONTENT[key] = stripFrontMatter(text);
      return ITEM_CONTENT[key];
    } catch (e) {
      console.warn(`[SystemViewer] Failed to load ${sectionId}/${itemId}.md:`, e.message);
      return null;
    }
  }

  async function loadArticleMarkdown(path) {
    if (ARTICLE_CONTENT[path]) return ARTICLE_CONTENT[path];
    try {
      const res = await fetch(`../content/${activeTab}/${path}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      ARTICLE_CONTENT[path] = stripFrontMatter(text);
      return ARTICLE_CONTENT[path];
    } catch (e) {
      console.warn(`[SystemViewer] Failed to load ${activeTab}/${path}:`, e.message);
      return null;
    }
  }

  function buildTabs(indexData) {
    const sections = (indexData && indexData.sections) || [];

    // If no sections loaded, use hardcoded fallback
    if (sections.length === 0) {
      SECTIONS = [
        { id: 'connectors', title: 'Connectors', description: 'Manage MacOS system integrations.' },
        { id: 'secrets', title: 'Secrets Manager', description: 'Token and API key templates.' },
        { id: 'skills', title: 'Skills', description: 'Reusable capabilities.' },
        { id: 'triggers', title: 'Triggers', description: 'Event-driven automations.' },
        { id: 'scripts', title: 'Scripts', description: 'Runnable automation scripts.' },
        { id: 'hooks', title: 'Hooks', description: 'CLI integration points.' },
      ];
    } else {
      SECTIONS = sections;
    }

    TABS = {};
    SECTIONS.forEach(s => {
      TABS[s.id] = {
        icon: ICON_MAP[s.id] || 'folder',
        label: s.title,
        description: s.description,
        sections: s.id === 'secrets' ? ['In-Use', 'Inactive'] : [],
        items: HARDCODED_ITEMS[s.id] || [],
        groups: s.groups || [],
      };
    });

    activeTab = SECTIONS[0]?.id || 'connectors';
  }

  function buildTabBar() {
    tabBar.innerHTML = '';
    SECTIONS.forEach((s, i) => {
      const btn = document.createElement('button');
      btn.className = 'tools-settings-tab' + (s.id === activeTab ? ' active' : '');
      btn.dataset.tab = s.id;
      btn.innerHTML = `<span class="material-symbols-outlined">${ICON_MAP[s.id] || 'folder'}</span>${escapeHtml(s.title)}`;
      tabBar.appendChild(btn);
    });
  }

  // ── Render ──
  function render() {
    const tab = TABS[activeTab];
    if (!tab) return;

    // Header — breadcrumb: System > Connectors
    tabTitle.innerHTML = `
      <span style="color:var(--text);">System</span>
      <span style="color:var(--text);">&gt;</span>
      <span style="color:var(--text);">${escapeHtml(tab.label)}</span>
    `;
    tabDesc.textContent = tab.description;

    // Tab bar
    tabBar.querySelectorAll('.tools-settings-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });

    // Settings list
    settingsList.innerHTML = '';

    // Guide link
    const guideLink = document.createElement('div');
    guideLink.className = `tools-guide-link ${showGuide ? 'active' : ''}`;
    guideLink.innerHTML = '<span class="material-symbols-outlined">menu_book</span>' + escapeHtml(tab.label) + ' Guide';
    guideLink.onclick = () => {
      selectedItemId = '';
      selectedArticleFile = '';
      showGuide = true;
      pushHistory({ showGuide: true, selectedItemId: '', selectedArticleFile: '' });
      render();
    };
    settingsList.appendChild(guideLink);

    // Items
    const items = tab.items || [];
    const sections = tab.sections?.length
      ? tab.sections
      : [...new Set(items.map(i => i.section).filter(Boolean))];

    if (sections.length > 0) {
      sections.forEach(section => {
        const divider = document.createElement('div');
        divider.className = 'tools-settings-section-divider';
        divider.textContent = section;
        settingsList.appendChild(divider);

        const sectionItems = items.filter(i => i.section === section);
        if (sectionItems.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'tools-settings-section-empty';
          empty.textContent = 'None';
          settingsList.appendChild(empty);
        }

        sectionItems.forEach(item => {
          settingsList.appendChild(renderItem(item));
        });
      });
    } else {
      items.forEach(item => {
        settingsList.appendChild(renderItem(item));
      });
    }

    // Detail panel
    renderDetail();

    // Sidebar
    renderSidebar();
  }

  function renderItem(item) {
    const el = document.createElement('div');
    const isConnector = activeTab === 'connectors';
    const isActive = selectedItemId === item.id && !showGuide;

    el.className = `tools-setting-item ${isActive ? 'active' : ''}`;

    if (isConnector) {
      const toggleHtml = item.comingSoon
        ? `<span class="tools-setting-item-badge">soon</span>`
        : `<button class="tools-toggle ${item.enabled ? 'on' : ''}" data-id="${item.id}" type="button"><span class="tools-toggle-knob"></span></button>`;

      el.innerHTML = `
        <div class="tools-setting-item-icon">
          <span class="material-symbols-outlined">${item.icon}</span>
        </div>
        <div class="tools-setting-item-text">
          <div class="tools-setting-item-name">${escapeHtml(item.name)}</div>
          <div class="tools-setting-item-desc">${escapeHtml(item.description)}</div>
        </div>
        <span class="tools-status-dot tools-status-dot--${item.status}" title="${item.status}"></span>
        ${toggleHtml}
      `;

      // Toggle click (only for non-coming-soon connectors)
      if (!item.comingSoon) {
        const toggleBtn = el.querySelector('.tools-toggle');
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          item.enabled = !item.enabled;
          item.status = item.enabled ? 'yellow' : 'gray';
          toggleBtn.classList.toggle('on', item.enabled);
          const dot = el.querySelector('.tools-status-dot');
          dot.className = `tools-status-dot tools-status-dot--${item.status}`;
          dot.title = item.status;
          window.parent.postMessage({ type: 'connector:toggled', id: item.id, enabled: item.enabled }, '*');
        });
      }

      // Item click (select, not toggle)
      el.addEventListener('click', (e) => {
        if (e.target.closest('.tools-toggle')) return;
        selectedItemId = item.id;
        selectedArticleFile = '';
        showGuide = false;
        pushHistory({ showGuide: false, selectedItemId: item.id, selectedArticleFile: '' });
        render();
      });
    } else {
      el.innerHTML = `
        <div class="tools-setting-item-icon">
          <span class="material-symbols-outlined">${item.icon}</span>
        </div>
        <div class="tools-setting-item-text">
          <div class="tools-setting-item-name">${escapeHtml(item.name)}</div>
          <div class="tools-setting-item-desc">${escapeHtml(item.description)}</div>
        </div>
      `;
      el.addEventListener('click', () => {
        selectedItemId = item.id;
        selectedArticleFile = '';
        showGuide = false;
        pushHistory({ showGuide: false, selectedItemId: item.id, selectedArticleFile: '' });
        render();
      });
    }

    return el;
  }

  function renderDetail() {
    const tab = TABS[activeTab];
    const item = (tab.items || []).find(i => i.id === selectedItemId);

    // Header title: article title > guide title > tab label
    detailHeader.classList.remove('hidden');
    if (selectedArticleFile) {
      detailTitle.textContent = getArticleTitle(selectedArticleFile) || tab.label;
    } else if (showGuide) {
      detailTitle.textContent = tab.label + ' Guide';
    } else {
      detailTitle.textContent = tab.label;
    }

    // Article view (from sidebar)
    if (selectedArticleFile) {
      const articleMd = ARTICLE_CONTENT[selectedArticleFile];
      if (articleMd) {
        const html = marked.parse(articleMd);
        detailScroll.innerHTML = `<div class="tools-detail-content">${html}</div>`;
        detailPath.textContent = `content/${activeTab}/${selectedArticleFile}`;
        return;
      }
      // Loading state
      detailScroll.innerHTML = `
        <div class="tools-detail-empty">
          <span class="material-symbols-outlined">hourglass_empty</span>
          <div style="font-size:0.875rem;color:var(--text-dim);">Loading article...</div>
        </div>
      `;
      loadArticleMarkdown(selectedArticleFile).then((loaded) => {
        if (loaded) render();
      });
      return;
    }

    if (showGuide || !item) {
      // Try loaded wiki file first
      const userMd = USER_CONTENT[activeTab];
      if (userMd) {
        const html = marked.parse(userMd);
        detailScroll.innerHTML = `<div class="tools-detail-content">${html}</div>`;
        detailPath.textContent = `content/${activeTab}/${getWikiFile(activeTab)}`;
        return;
      }

      // Fallback empty state
      detailScroll.innerHTML = `
        <div class="tools-detail-empty">
          <span class="material-symbols-outlined">${tab.icon}</span>
          <div style="font-size:1rem;font-weight:600;margin-bottom:8px;">${escapeHtml(tab.label)}</div>
          <div style="font-size:0.875rem;">${escapeHtml(tab.description)}</div>
        </div>
      `;
      return;
    }

    // Show item detail — try loaded markdown first, then hardcoded
    const itemMd = ITEM_CONTENT[`${activeTab}/${item.id}`];
    if (itemMd) {
      const html = marked.parse(itemMd);
      detailScroll.innerHTML = `<div class="tools-detail-content">${html}</div>`;
      detailPath.textContent = `content/${activeTab}/${item.id}.md`;
      return;
    }

    // Hardcoded fallback + async load attempt
    const html = marked.parse(item.detail || '# ' + item.name + '\n\nNo details available.');
    detailScroll.innerHTML = `<div class="tools-detail-content">${html}</div>`;
    detailPath.textContent = '';

    // Try loading markdown file in background
    loadItemMarkdown(activeTab, item.id).then((loaded) => {
      if (loaded) render();
    });
  }

  function getArticleTitle(file) {
    const tab = TABS[activeTab];
    const groups = tab.groups || [];
    for (const group of groups) {
      for (const article of (group.articles || [])) {
        if (article.file === file) return article.title;
      }
    }
    return '';
  }

  function renderSidebar() {
    const tab = TABS[activeTab];
    const groups = tab.groups || [];

    let html = '';

    // Groups and articles
    if (groups.length > 0) {
      groups.forEach(group => {
        html += `<div class="tools-sidebar-section">`;
        html += `<div class="tools-sidebar-section-title">${escapeHtml(group.title)}</div>`;
        (group.articles || []).forEach(article => {
          const isActive = selectedArticleFile === article.file;
          html += `<a class="tools-sidebar-link ${isActive ? 'active' : ''}" data-article-file="${escapeHtml(article.file)}">${escapeHtml(article.title)}</a>`;
        });
        html += `</div>`;
      });
    } else {
      // Fallback: show items from left panel
      const items = tab.items || [];
      const sections = [...new Set(items.map(i => i.section).filter(Boolean))];
      if (sections.length > 0) {
        sections.forEach(section => {
          html += `<div class="tools-sidebar-section">`;
          html += `<div class="tools-sidebar-section-title">${escapeHtml(section)}</div>`;
          items.filter(i => i.section === section).forEach(it => {
            const isActive = selectedItemId === it.id && !showGuide && !selectedArticleFile;
            html += `<a class="tools-sidebar-link ${isActive ? 'active' : ''}" data-sidebar-id="${escapeHtml(it.id)}">${escapeHtml(it.name)}</a>`;
          });
          html += `</div>`;
        });
      }
    }

    sidebarScroll.innerHTML = html;

    // Wire up sidebar clicks
    sidebarScroll.querySelectorAll('.tools-sidebar-link').forEach(link => {
      link.addEventListener('click', () => {
        if (link.dataset.articleFile) {
          selectedItemId = '';
          selectedArticleFile = link.dataset.articleFile;
          showGuide = false;
          pushHistory({ showGuide: false, selectedItemId: '', selectedArticleFile: link.dataset.articleFile });
        } else if (link.dataset.sidebarId) {
          selectedItemId = link.dataset.sidebarId;
          selectedArticleFile = '';
          showGuide = false;
          pushHistory({ showGuide: false, selectedItemId: link.dataset.sidebarId, selectedArticleFile: '' });
        }
        render();
      });
    });
  }

  // ── Navigation history ──
  let historyStack = [];
  let historyIndex = -1;

  function pushHistory(entry) {
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(entry);
    historyIndex++;
    updateNavButtons();
  }

  function goBack() {
    if (historyIndex > 0) {
      historyIndex--;
      restoreHistory();
    }
  }

  function goForward() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      restoreHistory();
    }
  }

  function restoreHistory() {
    const entry = historyStack[historyIndex];
    showGuide = entry.showGuide;
    selectedItemId = entry.selectedItemId || '';
    selectedArticleFile = entry.selectedArticleFile || '';
    render();
    updateNavButtons();
  }

  function updateNavButtons() {
    backBtn.disabled = historyIndex <= 0;
    forwardBtn.disabled = historyIndex >= historyStack.length - 1;
  }

  backBtn.addEventListener('click', goBack);
  forwardBtn.addEventListener('click', goForward);

  // ── Copy path button ──
  detailCopy.addEventListener('click', () => {
    const path = detailPath.textContent;
    if (!path) return;
    navigator.clipboard.writeText(path).then(() => {
      detailCopy.classList.add('copied');
      detailCopy.title = 'Copied!';
      setTimeout(() => {
        detailCopy.classList.remove('copied');
        detailCopy.title = 'Copy path';
      }, 1200);
    }).catch(() => {
      window.parent.postMessage({ type: 'copy-text', text: path }, '*');
    });
  });

  // ── Tab switching ──
  tabBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.tools-settings-tab');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    selectedItemId = '';
    selectedArticleFile = '';
    showGuide = true;
    historyStack = [{ showGuide: true, selectedItemId: '', selectedArticleFile: '' }];
    historyIndex = 0;
    updateNavButtons();
    // Pre-load markdown for the new tab
    loadUserMarkdown(activeTab).then(() => render());
  });

  // ── Theme + overlay mode via postMessage ──
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'theme-update' && event.data.tokens) {
      Object.entries(event.data.tokens).forEach(([key, value]) => {
        document.documentElement.style.setProperty(key, value);
      });
    }

    if (event.data.type === 'tools:mode' && event.data.mode) {
      document.body.dataset.overlay = event.data.mode === 'overlay' ? 'true' : 'false';
    }

    if (event.data.type === 'tools:activate-tab' && event.data.tab) {
      if (TABS[event.data.tab]) {
        activeTab = event.data.tab;
        selectedItemId = '';
        selectedArticleFile = '';
        showGuide = true;
        historyStack = [{ showGuide: true, selectedItemId: '', selectedArticleFile: '' }];
        historyIndex = 0;
        updateNavButtons();
        loadUserMarkdown(activeTab).then(() => render());
      }
    }
  });

  // ── Async init ──
  async function init() {
    const indexData = await loadContentIndex();
    buildTabs(indexData);
    buildTabBar();

    // Pre-load markdown for the default tab
    await loadUserMarkdown(activeTab);

    // Initialize navigation history
    historyStack = [{ showGuide: true, selectedItemId: '', selectedArticleFile: '' }];
    historyIndex = 0;
    updateNavButtons();

    render();

    if (window.parent !== window) {
      window.parent.postMessage({ type: 'view-ready', id: 'system-viewer' }, '*');
    }
  }

  init();
})();
