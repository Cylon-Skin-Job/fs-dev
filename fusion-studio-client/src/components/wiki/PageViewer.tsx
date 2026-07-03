/**
 * @module PageViewer
 * @role Center column — renders the selected wiki PAGE.md
 * @reads wikiStore: root, viewedPath, viewedPagePath, selectedContent, loading
 *
 * No tabs, no breadcrumbs. Header shows node name + back/forward nav.
 */

import { useCallback, useMemo } from 'react';
import { markdownToHtml } from '../../lib/transforms';
import { parseWikiPage, type WikiFrontmatter } from '../../lib/wiki-frontmatter';
import { findWikiNodeByPath, useWikiStore } from '../../state/wikiStore';
import { CopyPathButton } from '../CopyPathButton';
import { SendToChatButton } from '../SendToChatButton';

const METADATA_SECTIONS: Array<{ key: string; label: string }> = [
  { key: 'incoming-edges', label: 'Incoming Edges' },
  { key: 'outgoing-edges', label: 'Outgoing Edges' },
  { key: 'source-files', label: 'Source Files' },
  { key: 'connected-skills', label: 'Connected Skills' },
  { key: 'related-trigger-files', label: 'Related Trigger Files' },
];

function WikiPageHeader({ frontmatter }: { frontmatter: WikiFrontmatter | null }) {
  if (!frontmatter?.name && !frontmatter?.description) return null;

  return (
    <div className="rv-wiki-page-frontmatter-header">
      {frontmatter.name && <h1>{frontmatter.name}</h1>}
      {frontmatter.description && <p>{frontmatter.description}</p>}
    </div>
  );
}

function WikiMetadataFooter({ frontmatter }: { frontmatter: WikiFrontmatter | null }) {
  if (!frontmatter) return null;

  const sections = METADATA_SECTIONS.map((section) => ({
    ...section,
    items: frontmatter.metadata[section.key] || [],
  }));

  return (
    <div className="rv-wiki-page-metadata-footer">
      {sections.map((section) => (
        <section key={section.key}>
          <h2>{section.label}</h2>
          {section.items.length > 0 ? (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>None</p>
          )}
        </section>
      ))}
    </div>
  );
}

export function PageViewer() {
  const root = useWikiStore((s) => s.root);
  const viewedPath = useWikiStore((s) => s.viewedPath);
  const viewedPagePath = useWikiStore((s) => s.viewedPagePath);
  const selectedContent = useWikiStore((s) => s.selectedContent);
  const loading = useWikiStore((s) => s.loading);
  const error = useWikiStore((s) => s.error);
  const historyIndex = useWikiStore((s) => s.historyIndex);
  const history = useWikiStore((s) => s.history);
  const goBack = useWikiStore((s) => s.goBack);
  const goForward = useWikiStore((s) => s.goForward);
  const viewNode = useWikiStore((s) => s.viewNode);

  const selectedNode = useMemo(
    () => findWikiNodeByPath(root, viewedPath),
    [root, viewedPath]
  );

  const title = selectedNode?.label || 'Wiki';
  const relativePath = viewedPagePath;
  const parsedPage = useMemo(() => parseWikiPage(selectedContent), [selectedContent]);
  const rendered = useMemo(() => markdownToHtml(parsedPage.body), [parsedPage.body]);

  // Intercept wiki-internal links and navigate within the wiki viewer
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href') || '';
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('/')) return;

    const combined = viewedPath ? `${viewedPath}/${href}` : href;
    const parts = combined.split('/');
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '..') resolved.pop();
      else if (part !== '.' && part !== '') resolved.push(part);
    }
    if (resolved[resolved.length - 1] === 'PAGE.md') resolved.pop();

    const node = findWikiNodeByPath(root, resolved.join('/'));
    if (node) {
      e.preventDefault();
      viewNode(node);
    }
  }, [root, viewNode, viewedPath]);

  if (!selectedNode) {
    return (
      <div className="rv-wiki-page-viewer">
        <div className="rv-wiki-page-empty">
          <span className="material-symbols-outlined">full_coverage</span>
          <p>Select a wiki page to view</p>
        </div>
      </div>
    );
  }

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
        <span className="rv-wiki-breadcrumb">{title}</span>
        <div className="rv-wiki-nav-actions">
          {relativePath && (
            <>
              <CopyPathButton
                panel="wiki-viewer"
                relativePath={relativePath}
                className="rv-file-page-action"
                title="Copy article path"
              />
              <SendToChatButton
                panel="wiki-viewer"
                relativePath={relativePath}
                className="rv-file-page-action"
                title="Send article path to chat"
              />
            </>
          )}
        </div>
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

      <div className="rv-wiki-page-content rv-document-surface">
        <WikiPageHeader frontmatter={parsedPage.frontmatter} />
        <div dangerouslySetInnerHTML={{ __html: rendered as string }} />
        <WikiMetadataFooter frontmatter={parsedPage.frontmatter} />
      </div>
    </div>
  );
}
