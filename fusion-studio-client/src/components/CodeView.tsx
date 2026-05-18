/**
 * @module CodeView
 * @role Shared syntax-highlighted code viewer with line numbers.
 *
 * Two modes:
 *   - 'code' (default): syntax-highlighted raw text with line gutter
 *   - 'markdown': rendered HTML via markdownToHtml
 *
 * Used by: FileContentRenderer, FilePageView (code ↔ rendered MD toggle), PromptCardView, etc.
 * Shared styles: src/styles/document.css (.code-editor, .wiki-page-content).
 */

import { useMemo } from 'react';
import { highlightCode, markdownToHtml, stripFrontmatter } from '../lib/transforms';

interface CodeViewProps {
  content: string;
  extension?: string;
  mode?: 'code' | 'markdown';
}

export function CodeView({ content, extension, mode = 'code' }: CodeViewProps) {
  const markdownHtml = useMemo(() => {
    if (mode !== 'markdown') return '';
    return markdownToHtml(stripFrontmatter(content));
  }, [content, mode]);

  const highlighted = useMemo(() => {
    if (mode !== 'code') return '';
    return highlightCode(content, extension);
  }, [content, extension, mode]);

  const lines = useMemo(() => {
    if (mode !== 'code') return [];
    return highlighted.split('\n');
  }, [highlighted, mode]);

  const codeHtml = useMemo(() => {
    if (mode !== 'code') return '';
    return lines
      .map((line) => `<span class="rv-code-line">${line || ' '}</span>`)
      .join('');
  }, [lines, mode]);

  // Mark markdown source files so the syntax palette stays on the rainbow
  // (--hljs-md-*) regardless of the global Theme Code toggle. Applies to both
  // rendered-markdown view AND raw-code view of the same file.
  const mdSource = extension === 'md' || extension === 'markdown' ? ' rv-md-source' : '';

  if (mode === 'markdown') {
    return (
      <div
        className={`rv-wiki-page-content${mdSource}`}
        dangerouslySetInnerHTML={{ __html: markdownHtml }}
      />
    );
  }

  return (
    <div className={`rv-code-editor${mdSource}`}>
      <div className="rv-code-gutter">
        {lines.map((_, i) => (
          <span key={i} className="rv-line-number">{i + 1}</span>
        ))}
      </div>
      <div className="rv-code-content">
        <pre>
          <code dangerouslySetInnerHTML={{ __html: codeHtml }} />
        </pre>
      </div>
    </div>
  );
}
