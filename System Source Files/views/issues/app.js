/**
 * Issues View — Self-contained ticket board
 *
 * Loads tickets from workspace ai/views/issues-viewer/ via fusion-studio://
 * Renders Kanban columns: Inbox | Open | Completed
 * Consumes theme tokens and file-change events from shell via postMessage
 */

(function () {
  'use strict';

  const ALLOWED_ORIGIN = 'fusion-studio://';
  const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3001'];
  const isDev = DEV_ORIGINS.includes(location.origin);
  const allowed = isDev ? [...DEV_ORIGINS, ALLOWED_ORIGIN] : [ALLOWED_ORIGIN];

  // ─── State ───
  let tickets = [];
  let activeTicketId = null;
  let currentWorkspaceId = null;

  // ─── DOM refs ───
  const els = {
    inboxItems: document.getElementById('inbox-items'),
    openItems: document.getElementById('open-items'),
    completedItems: document.getElementById('completed-items'),
    inboxCount: document.getElementById('inbox-count'),
    openCount: document.getElementById('open-count'),
    completedCount: document.getElementById('completed-count'),
    ticketCount: document.getElementById('ticket-count'),
    detailPanel: document.getElementById('detail-panel'),
    detailContent: document.getElementById('detail-content'),
    detailClose: document.getElementById('detail-close'),
  };

  // ─── Security: validate origin ───
  function isAllowedOrigin(origin) {
    return allowed.includes(origin);
  }

  // ─── Theme tokens ───
  function applyTheme(tokens) {
    const root = document.documentElement;
    Object.entries(tokens).forEach(([key, value]) => {
      root.style.setProperty(`--shell-${key}`, value);
    });
  }

  // ─── Ticket loading ───
  async function loadTickets() {
    try {
      const res = await fetch('content/tickets.json');
      if (!res.ok) throw new Error('Failed to load tickets.json');
      const data = await res.json();
      tickets = Object.entries(data.tickets || {}).map(([id, t]) => ({ id, ...t }));
      renderBoard();
    } catch (err) {
      console.error('[Issues] loadTickets failed:', err);
      showError('Failed to load tickets');
    }
  }

  // ─── Parse markdown ticket for detail view ───
  async function loadTicketDetail(ticketId) {
    // Try inbox first, then other folders
    const folders = ['inbox', 'open', 'complete', 'archive'];
    for (const folder of folders) {
      try {
        const res = await fetch(`${folder}/${ticketId}.md`);
        if (res.ok) {
          const raw = await res.text();
          return parseTicketMarkdown(raw);
        }
      } catch { /* try next folder */ }
    }
    return null;
  }

  function parseTicketMarkdown(raw) {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!fmMatch) return { frontmatter: {}, body: raw.trim() };

    const fm = {};
    fmMatch[1].split('\n').forEach(line => {
      const [key, ...rest] = line.split(':');
      if (key && rest.length) {
        fm[key.trim()] = rest.join(':').trim().replace(/^['"](.*)['"]$/s, '$1');
      }
    });

    return { frontmatter: fm, body: fmMatch[2].trim() };
  }

  // ─── Rendering ───
  function renderBoard() {
    const inbox = tickets.filter(t => t.state === 'open' && !isBot(t.assignee));
    const open = tickets.filter(t => t.state === 'open' && isBot(t.assignee));
    const completed = tickets.filter(t => t.state === 'closed');

    renderColumn(els.inboxItems, inbox);
    renderColumn(els.openItems, open);
    renderColumn(els.completedItems, completed);

    els.inboxCount.textContent = inbox.length;
    els.openCount.textContent = open.length;
    els.completedCount.textContent = completed.length;
    els.ticketCount.textContent = `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`;
  }

  function isBot(assignee) {
    const bots = ['kimi-wiki', 'kimi-code', 'kimi-review', 'kimi-bot', 'system'];
    return bots.includes(assignee);
  }

  function renderColumn(container, items) {
    container.innerHTML = '';
    if (items.length === 0) {
      container.innerHTML = '<div class="column-empty">No tickets</div>';
      return;
    }
    items.forEach(ticket => {
      const card = createTicketCard(ticket);
      container.appendChild(card);
    });
  }

  function createTicketCard(ticket) {
    const el = document.createElement('div');
    el.className = `ticket-card ${ticket.id === activeTicketId ? 'active' : ''}`;
    el.dataset.id = ticket.id;
    el.innerHTML = `
      <div class="ticket-id">${escapeHtml(ticket.id)}</div>
      <div class="ticket-title">${escapeHtml(ticket.title)}</div>
      <div class="ticket-meta">
        <span class="ticket-assignee ${isBot(ticket.assignee) ? 'bot' : ''}">
          <span class="material-symbols-outlined" style="font-size:14px">${isBot(ticket.assignee) ? 'smart_toy' : 'person'}</span>
          ${escapeHtml(ticket.assignee)}
        </span>
        <span class="ticket-time">${formatTime(ticket.created)}</span>
      </div>
    `;
    el.addEventListener('click', () => selectTicket(ticket.id));
    return el;
  }

  // ─── Granular DOM updates ───
  function updateTicketCard(ticketId, change) {
    const existing = document.querySelector(`.ticket-card[data-id="${ticketId}"]`);

    if (change === 'removed') {
      if (existing) existing.remove();
      if (activeTicketId === ticketId) closeDetail();
      recalcCounts();
      return;
    }

    if (change === 'modified' && existing) {
      // Find updated ticket data
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;
      const newCard = createTicketCard(ticket);
      existing.replaceWith(newCard);
      return;
    }

    if (change === 'added') {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;
      const card = createTicketCard(ticket);
      const column = getColumnForTicket(ticket);
      const empty = column.querySelector('.column-empty');
      if (empty) empty.remove();
      column.appendChild(card);
      recalcCounts();
    }
  }

  function getColumnForTicket(ticket) {
    if (ticket.state === 'closed') return els.completedItems;
    if (isBot(ticket.assignee)) return els.openItems;
    return els.inboxItems;
  }

  function recalcCounts() {
    const inbox = els.inboxItems.querySelectorAll('.ticket-card').length;
    const open = els.openItems.querySelectorAll('.ticket-card').length;
    const completed = els.completedItems.querySelectorAll('.ticket-card').length;
    const total = inbox + open + completed;

    els.inboxCount.textContent = inbox;
    els.openCount.textContent = open;
    els.completedCount.textContent = completed;
    els.ticketCount.textContent = `${total} ticket${total !== 1 ? 's' : ''}`;

    // Show empty states
    [els.inboxItems, els.openItems, els.completedItems].forEach(col => {
      if (col.children.length === 0) {
        col.innerHTML = '<div class="column-empty">No tickets</div>';
      }
    });
  }

  // ─── Selection / Detail ───
  async function selectTicket(id) {
    activeTicketId = id;
    document.querySelectorAll('.ticket-card').forEach(c => c.classList.toggle('active', c.dataset.id === id));

    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    const detail = await loadTicketDetail(id);
    renderDetail(ticket, detail);
    els.detailPanel.hidden = false;
  }

  function renderDetail(ticket, detail) {
    const fm = detail?.frontmatter || {};
    els.detailContent.innerHTML = `
      <div class="detail-id">${escapeHtml(ticket.id)}</div>
      <h2>${escapeHtml(ticket.title)}</h2>
      <div class="detail-fields">
        <span class="detail-label">Assignee</span><span>${escapeHtml(ticket.assignee)}</span>
        <span class="detail-label">State</span><span>${escapeHtml(ticket.state)}</span>
        <span class="detail-label">Author</span><span>${escapeHtml(ticket.author || fm.author || 'unknown')}</span>
        <span class="detail-label">Created</span><span>${escapeHtml(ticket.created)}</span>
        ${ticket.priority ? `<span class="detail-label">Priority</span><span>${escapeHtml(ticket.priority)}</span>` : ''}
        ${ticket.blocked_by ? `<span class="detail-label">Blocked By</span><span>${escapeHtml(ticket.blocked_by)}</span>` : ''}
      </div>
      <div class="detail-body">${escapeHtml(detail?.body || ticket.body || '(no description)')}</div>
    `;
  }

  function closeDetail() {
    activeTicketId = null;
    els.detailPanel.hidden = true;
    document.querySelectorAll('.ticket-card').forEach(c => c.classList.remove('active'));
  }

  // ─── postMessage handlers ───
  window.addEventListener('message', (event) => {
    if (!isAllowedOrigin(event.origin)) return;

    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'theme:tokens':
        applyTheme(msg.tokens);
        break;

      case 'file:changed': {
        const { path, change } = msg;
        if (!path || !path.endsWith('.md')) return;
        const basename = path.split('/').pop();
        const ticketId = basename.replace('.md', '');

        if (change === 'added') {
          // Reload all tickets to get the new one
          loadTickets();
        } else if (change === 'modified') {
          loadTickets();
        } else if (change === 'removed') {
          tickets = tickets.filter(t => t.id !== ticketId);
          updateTicketCard(ticketId, 'removed');
        }
        break;
      }

      case 'workspace:switched':
        currentWorkspaceId = msg.workspaceId;
        loadTickets();
        break;

      default:
        // Unknown message type — ignore silently
        break;
    }
  });

  // ─── Event listeners ───
  els.detailClose.addEventListener('click', closeDetail);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDetail();
  });

  // ─── Utilities ───
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(iso) {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now - d;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    } catch {
      return '';
    }
  }

  function showError(message) {
    els.inboxItems.innerHTML = `<div class="column-empty">Error: ${escapeHtml(message)}</div>`;
    els.openItems.innerHTML = '';
    els.completedItems.innerHTML = '';
  }

  // ─── Init ───
  // Request theme tokens from shell
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'view:ready', id: 'issues' }, ALLOWED_ORIGIN);
  }

  // Load initial data
  loadTickets();
})();
