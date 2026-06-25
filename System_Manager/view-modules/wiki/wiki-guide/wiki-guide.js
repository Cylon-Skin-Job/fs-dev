/**
 * wiki-guide.js — Left panel + guide paradigm module
 *
 * Renders configurable left-panel items (toggles, buttons, links)
 * and binds them to wiki content. Provides guide-link + section
 * dividers + item rows.
 *
 * Expects: WikiViewer (from wiki-viewer.js) to be loaded first.
 */

(function (global) {
  'use strict';

  const WikiGuide = {
    // ── Render left panel ──
    render(container, config, options = {}) {
      const { activeItem, activeGuide, onItemClick, onGuideClick } = options;
      container.innerHTML = '';

      // Guide link
      if (config.showGuide !== false) {
        const guideLink = document.createElement('div');
        guideLink.className = `wiki-guide-link ${activeGuide ? 'active' : ''}`;
        guideLink.innerHTML = '<span class="material-symbols-outlined">menu_book</span>' + this._escape(config.title || 'Guide');
        guideLink.onclick = () => {
          if (onGuideClick) onGuideClick();
        };
        container.appendChild(guideLink);
      }

      // Items
      const items = config.items || [];
      const sections = [...new Set(items.map(i => i.section).filter(Boolean))];

      if (sections.length > 0) {
        sections.forEach(section => {
          const divider = document.createElement('div');
          divider.className = 'wiki-settings-section-divider';
          divider.textContent = section;
          container.appendChild(divider);

          items.filter(i => i.section === section).forEach(item => {
            container.appendChild(this._renderItem(item, activeItem, onItemClick));
          });
        });
      } else {
        items.forEach(item => {
          container.appendChild(this._renderItem(item, activeItem, onItemClick));
        });
      }
    },

    _renderItem(item, activeItemId, onItemClick) {
      const el = document.createElement('div');
      const isActive = activeItemId === item.id;
      el.className = `wiki-settings-item ${isActive ? 'active' : ''}`;
      el.dataset.id = item.id;

      const iconHtml = item.icon
        ? `<span class="material-symbols-outlined">${this._escape(item.icon)}</span>`
        : '';

      // Status indicator
      const statusClass = item.status ? `wiki-status-${item.status}` : '';

      el.innerHTML = `
        <div class="wiki-settings-item-inner">
          ${iconHtml}
          <div class="wiki-settings-item-text">
            <div class="wiki-settings-item-name">${this._escape(item.title || item.name)}</div>
            ${item.description ? `<div class="wiki-settings-item-desc">${this._escape(item.description)}</div>` : ''}
          </div>
          ${item.type === 'toggle' ? `<div class="wiki-toggle ${item.enabled ? 'on' : 'off'} ${statusClass}"><div class="wiki-toggle-knob"></div></div>` : ''}
        </div>
      `;

      // Toggle click
      if (item.type === 'toggle') {
        const toggle = el.querySelector('.wiki-toggle');
        if (toggle) {
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            item.enabled = !item.enabled;
            toggle.classList.toggle('on', item.enabled);
            toggle.classList.toggle('off', !item.enabled);
            this._emit('toggle:changed', { id: item.id, enabled: item.enabled, item });
          });
        }
      }

      // Row click
      el.addEventListener('click', () => {
        if (onItemClick) onItemClick(item);
      });

      return el;
    },

    _escape(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    // ── Events ──
    listeners: {},
    on(event, handler) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(handler);
    },
    _emit(event, data) {
      (this.listeners[event] || []).forEach(h => h(data));
    },
  };

  global.WikiGuide = WikiGuide;
})(window);
