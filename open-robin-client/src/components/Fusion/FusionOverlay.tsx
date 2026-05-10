/**
 * @module FusionOverlay
 * @role Full-screen system panel overlay
 *
 * Fusion Studio sits above workspaces as the system supervisor.
 * Chat on the left, tabbed settings with list/detail split on the right.
 *
 * All data (tabs, items, wiki content, CLI registry) comes from fusion.db
 * via WebSocket. Nothing is hardcoded — add a tab to the database and it
 * appears here automatically.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { sendFusionMessage, onFusionMessage } from '../../lib/ws-client';
import { WikiDetail } from './WikiDetail';
import { ConfigDetail } from './ConfigDetail';
import { CLIDetail, CLIRegistry } from './CLIDetail';
import type { Tab, WikiPage, ConfigItem, CliItem } from './fusion-types';
import './fusion.css';

// --- Types ---

interface FusionOverlayProps {
  open: boolean;
  onClose: () => void;
}

// --- Chat messages (placeholder until Fusion's wire is connected) ---

const CHAT_MESSAGES = [
  { type: 'system' as const, text: 'Session started' },
  { type: 'fusion' as const, text: 'Hey! Everything\u2019s running smoothly. Two conversations are open and your agents are idle. What can I help with?' },
  { type: 'user' as const, text: 'How do the safety settings work?' },
  { type: 'fusion' as const, text: 'Great question. Your AI assistants can\u2019t change their own settings \u2014 only you can. When an AI wants to suggest new configuration, it creates a draft and you get a visual approval screen. You drag the file to accept, or just close it to reject. I\u2019ve pulled up the details for you \u2192' },
  { type: 'system' as const, text: 'Viewing: Settings Protection' },
];

// --- Main component ---

export function FusionOverlay({ open, onClose }: FusionOverlayProps) {
  // Data from fusion.db
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [items, setItems] = useState<(ConfigItem | CliItem)[]>([]);
  const [wikiPage, setWikiPage] = useState<WikiPage | null>(null);
  const [registryItems, setRegistryItems] = useState<CliItem[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [showRegistry, setShowRegistry] = useState(false);
  const initializedRef = useRef(false);

  // Wiki context toggle
  const [showContext, setShowContext] = useState(false);

  // Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Subscribe to fusion: messages
  useEffect(() => {
    const unsubs = [
      onFusionMessage('robin:tabs', (msg: any) => {
        setTabs(msg.tabs || []);
        // On first load, activate the first tab
        if (!initializedRef.current && msg.tabs?.length > 0) {
          initializedRef.current = true;
          const firstTab = msg.tabs[0].id;
          setActiveTab(firstTab);
          sendFusionMessage({ type: 'robin:tab-items', tab: firstTab });
          sendFusionMessage({ type: 'robin:wiki-page', slug: firstTab });
        }
      }),
      onFusionMessage('robin:items', (msg: any) => {
        setItems(msg.items || []);
        // For CLIs tab, separate installed from registry
        if (msg.tab === 'clis') {
          const installed = (msg.items || []).filter((i: CliItem) => i.installed);
          const notInstalled = (msg.items || []).filter((i: CliItem) => !i.installed);
          setItems(installed);
          setRegistryItems(notInstalled);
        }
      }),
      onFusionMessage('robin:wiki', (msg: any) => {
        if (!msg.error) {
          setWikiPage(msg as WikiPage);
        }
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, []);

  // Fetch tabs when panel opens
  useEffect(() => {
    if (open) {
      initializedRef.current = false;
      sendFusionMessage({ type: 'robin:tabs' });
    }
  }, [open]);

  if (!open) return null;

  // Derive sections from config items (non-CLI tabs)
  const configItems = items as ConfigItem[];
  const sectionNames = [...new Set(configItems.map(s => s.section).filter(Boolean))];

  const currentTab = tabs.find(t => t.id === activeTab);

  // Determine right panel content
  const selectedItem = items.find((s: any) => (s.key || s.id) === selectedItemId);

  function switchTab(tabId: string) {
    setActiveTab(tabId);
    setSelectedItemId('');
    setShowRegistry(false);
    setShowContext(false);
    setWikiPage(null);
    setItems([]);
    sendFusionMessage({ type: 'robin:tab-items', tab: tabId });
    sendFusionMessage({ type: 'robin:wiki-page', slug: tabId });
    sendFusionMessage({ type: 'robin:context', tab: tabId, item: null });
  }

  function selectItem(id: string) {
    setSelectedItemId(id);
    setShowRegistry(false);
    setShowContext(false);
    sendFusionMessage({ type: 'robin:context', tab: activeTab, item: id });
  }

  function openRegistry() {
    setShowRegistry(true);
    setSelectedItemId('');
  }

  return (
    <div className="rv-fusion-overlay">
      {/* Header */}
      <div className="rv-fusion-overlay-header">
        <div className="rv-fusion-overlay-header-left">
          <span className="material-symbols-outlined rv-fusion-overlay-header-icon">raven</span>
          <span className="rv-fusion-overlay-header-name">Fusion Studio</span>
          <span className="rv-fusion-overlay-header-subtitle">System Panel</span>
        </div>
        <button className="rv-fusion-exit-btn" onClick={onClose}>
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Body: Chat | Settings */}
      <div className="rv-fusion-overlay-body">

        {/* LEFT: Chat */}
        <div className="rv-fusion-chat">
          <div className="rv-fusion-chat-messages">
            {CHAT_MESSAGES.map((msg, i) => {
              if (msg.type === 'system') {
                return <div key={i} className="rv-fusion-msg-system">{msg.text}</div>;
              }
              if (msg.type === 'user') {
                return (
                  <div key={i} className="rv-fusion-msg-user">
                    <div className="rv-fusion-msg-bubble" dangerouslySetInnerHTML={{ __html: msg.text }} />
                  </div>
                );
              }
              return (
                <div key={i} className="rv-fusion-msg-fusion">
                  <div className="rv-fusion-msg-avatar">
                    <span className="material-symbols-outlined">raven</span>
                  </div>
                  <div className="rv-fusion-msg-bubble" dangerouslySetInnerHTML={{ __html: msg.text }} />
                </div>
              );
            })}
          </div>
          <div className="rv-fusion-chat-input">
            <textarea rows={2} placeholder="Ask Fusion Studio anything..." />
          </div>
        </div>

        {/* RIGHT: Settings */}
        <div className="rv-fusion-settings">

          {/* Tab header */}
          {currentTab && (
            <div className="rv-fusion-settings-header">
              <div className="rv-fusion-settings-header-info">
                <div className="rv-fusion-settings-header-title">
                  <span className="material-symbols-outlined">{currentTab.icon}</span>
                  {currentTab.label}
                </div>
                <div className="rv-fusion-settings-header-desc">
                  {currentTab.description}
                </div>
              </div>
            </div>
          )}

          {/* Tab bar */}
          <div className="rv-fusion-settings-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`rv-fusion-settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => switchTab(tab.id)}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Split: list + detail */}
          <div className="rv-fusion-settings-split">

            {/* Settings list */}
            <div className="rv-fusion-settings-list">

              {/* Guide link — always at top, returns right panel to wiki */}
              <div
                className={`rv-fusion-guide-link ${!selectedItemId && !showRegistry ? 'active' : ''}`}
                onClick={() => { setSelectedItemId(''); setShowRegistry(false); }}
              >
                <span className="material-symbols-outlined">menu_book</span>
                {currentTab?.label} Guide
              </div>

              <div className="rv-fusion-list-separator" />

              {activeTab === 'clis' ? (
                // CLIs tab: show installed CLIs as flat list
                <>
                  {(items as CliItem[]).map(cli => (
                    <div
                      key={cli.id}
                      className={`rv-fusion-setting-item ${selectedItemId === cli.id && !showRegistry ? 'active' : ''}`}
                      onClick={() => selectItem(cli.id)}
                    >
                      <div className="rv-fusion-setting-item-icon">
                        <span className="material-symbols-outlined">terminal</span>
                      </div>
                      <div className="rv-fusion-setting-item-text">
                        <div className="rv-fusion-setting-item-name">{cli.name}</div>
                        <div className="rv-fusion-setting-item-desc">{cli.description}</div>
                      </div>
                      <span className={`rv-fusion-setting-item-badge ${cli.active ? 'on' : 'off'}`}>
                        {cli.active ? 'active' : 'installed'}
                      </span>
                    </div>
                  ))}
                </>
              ) : activeTab === 'system-wiki' ? (
                // System wiki: simple index links
                <div className="rv-fusion-wiki-index">
                  {configItems.map(item => (
                    <div
                      key={item.key}
                      className={`rv-fusion-wiki-index-item ${selectedItemId === item.key ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedItemId(item.key);
                        setShowContext(false);
                        if (item.wiki_slug) {
                          sendFusionMessage({ type: 'robin:wiki-page', slug: item.wiki_slug });
                        }
                        sendFusionMessage({ type: 'robin:context', tab: activeTab, item: item.key });
                      }}
                    >
                      <span className="rv-fusion-wiki-index-title">{item.key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bCli\b/g, 'CLI').replace(/\bAi\b/g, 'AI').replace(/\bApi\b/g, 'API').replace(/\bLlm\b/g, 'LLM')}</span>
                      <span className="rv-fusion-wiki-index-desc">{item.description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                // Other tabs: group by section
                sectionNames.map(section => (
                  <div key={section}>
                    <div className="rv-fusion-settings-section-divider">{section}</div>
                    {configItems.filter(s => s.section === section).map(item => (
                      <div
                        key={item.key}
                        className={`rv-fusion-setting-item ${selectedItemId === item.key && !showRegistry ? 'active' : ''}`}
                        onClick={() => selectItem(item.key)}
                      >
                        <div className="rv-fusion-setting-item-icon">
                          <span className="material-symbols-outlined">{item.icon}</span>
                        </div>
                        <div className="rv-fusion-setting-item-text">
                          <div className="rv-fusion-setting-item-name">{item.key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
                          <div className="rv-fusion-setting-item-desc">{item.description}</div>
                        </div>
                        <span className={`rv-fusion-setting-item-badge ${item.value === 'true' ? 'on' : 'value'}`}>
                          {item.value === 'true' ? 'on' : item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                ))
              )}

              {/* Add button — CLIs and LLM Providers tabs */}
              {activeTab === 'clis' && (
                <button
                  className={`rv-fusion-add-btn ${showRegistry ? 'active' : ''}`}
                  onClick={openRegistry}
                >
                  <span className="material-symbols-outlined">add</span>
                  Add CLI
                </button>
              )}
              {activeTab === 'llm-providers' && (
                <button
                  className={`rv-fusion-add-btn ${showRegistry ? 'active' : ''}`}
                  onClick={openRegistry}
                >
                  <span className="material-symbols-outlined">add</span>
                  Add Provider
                </button>
              )}
            </div>

            {/* Right panel: wiki, item detail, registry, or customization */}
            <div className="rv-fusion-detail">
              <div className="rv-fusion-detail-scroll">
                {showRegistry && activeTab === 'clis' ? (
                  <CLIRegistry items={registryItems} />
                ) : selectedItem && activeTab !== 'system-wiki' ? (
                  activeTab === 'clis' ? (
                    <CLIDetail cli={selectedItem as CliItem} />
                  ) : (
                    <ConfigDetail item={selectedItem as ConfigItem} tabLabel={currentTab?.label || ''} />
                  )
                ) : wikiPage ? (
                  <WikiDetail page={wikiPage} showContext={showContext} onToggleContext={() => setShowContext(!showContext)} />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
