/**
 * InstantSegmentRenderer — No animation, all collapsed, same visual identity.
 *
 * Used for history messages, thread switches, and re-renders.
 * Groups consecutive same-type groupable segments into one block.
 */

import { useState } from 'react';
import { renderTextInstant } from '../lib/text';
import type { StreamSegment } from '../types';
import { isGroupable } from '../lib/catalog-visual';
import { getToolRenderer } from '../lib/tool-renderers';
import { ToolCallBlock } from './ToolCallBlock';

interface InstantSegmentRendererProps {
  segments?: StreamSegment[];
}

/** A group of consecutive same-type segments, or a single segment */
interface SegmentGroup {
  type: 'single' | 'group';
  segments: StreamSegment[];
}

function groupSegments(segments: StreamSegment[]): SegmentGroup[] {
  const groups: SegmentGroup[] = [];
  let i = 0;

  while (i < segments.length) {
    const seg = segments[i];

    if (isGroupable(seg.type)) {
      // Collect consecutive same-type groupable segments
      const group: StreamSegment[] = [seg];
      let j = i + 1;
      while (j < segments.length && segments[j].type === seg.type && isGroupable(segments[j].type)) {
        group.push(segments[j]);
        j++;
      }
      groups.push({ type: group.length > 1 ? 'group' : 'single', segments: group });
      i = j;
    } else {
      groups.push({ type: 'single', segments: [seg] });
      i++;
    }
  }

  return groups;
}

export function InstantSegmentRenderer({ segments }: InstantSegmentRendererProps) {
  if (!segments || segments.length === 0) {
    return <div className="rv-message-assistant-content" />;
  }

  const groups = groupSegments(segments);

  return (
    <>
      {groups.map((group, gi) => {
        if (group.segments[0].type === 'text') {
          return <InstantText key={`text-${gi}`} content={group.segments[0].content} />;
        }

        if (group.type === 'group') {
          return (
            <InstantGroupedBlock
              key={`group-${gi}`}
              segments={group.segments}
            />
          );
        }

        const segment = group.segments[0];
        return (
          <div key={segment.toolCallId || `seg-${gi}`}>
            <InstantToolBlock segment={segment} />
          </div>
        );
      })}
    </>
  );
}

// ── Instant Text ──────────────────────────────────────────────────────

function InstantText({ content }: { content: string }) {
  if (!content) return null;
  const html = renderTextInstant(content);
  return (
    <div
      className="rv-message-assistant-content"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Instant Tool Block (single) ───────────────────────────────────────

function InstantToolBlock({ segment }: { segment: StreamSegment }) {
  const [expanded, setExpanded] = useState(false);
  const renderer = getToolRenderer(segment.type);
  const renderedContent = renderer.formatContent(segment.content, segment.toolArgs, segment);

  return (
    <ToolCallBlock
      type={segment.type}
      label={renderer.buildTitle(segment.groupCount ?? 1, segment.toolArgs, segment)}
      toolArgs={segment.toolArgs}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      {renderedContent && (
        <div
          style={renderer.contentStyle}
          dangerouslySetInnerHTML={{
            __html: renderedContent,
          }}
        />
      )}
    </ToolCallBlock>
  );
}

// ── Instant Grouped Block ─────────────────────────────────────────────

function InstantGroupedBlock({ segments }: { segments: StreamSegment[] }) {
  const [expanded, setExpanded] = useState(false);
  const type = segments[0].type;
  const renderer = getToolRenderer(type);

  return (
    <ToolCallBlock
      type={type}
      label={renderer.buildTitle(segments[0].groupCount ?? segments.length, segments[0].toolArgs, segments[0])}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
    >
      <div
        style={renderer.contentStyle}
        dangerouslySetInnerHTML={{
          __html: segments.map(seg =>
            renderer.formatContent(seg.content, seg.toolArgs, seg)
          ).join(''),
        }}
      />
    </ToolCallBlock>
  );
}
