/**
 * Tool Animate — Level 2b Controller for tool segments.
 *
 * Pure async function. No React. No DOM.
 * Parallel to text-animate.ts (Level 2a for text segments).
 *
 * Pipeline: catalog lookup → strategy → transform → render → reveal.
 *
 * The strategy accumulates content and emits tagged chunks.
 * The adapter bridges ActiveChunkStrategy to the existing ChunkParser
 * interface so we can reuse orchestrateReveal() without rewriting it.
 */

import type { SegmentType } from '../types';
import type { TaggedChunk } from '../types/tagged-chunk';
import type { ActiveChunkStrategy } from '../types/active-strategy';
import type { TimingProfile } from './pressure';
import type { ChunkParser, ParsedChunk, RevealOptions } from './reveal/types';
import { lookup } from './catalog';
import type { CatalogEntry } from './catalog';
import { sleep } from './animate-utils';

// =============================================================================
// PUBLIC INTERFACE
// =============================================================================

export interface ToolAnimateOptions {
  contentRef: { current: string };
  completeRef: { current: boolean };
  cancelRef: { current: boolean };
  segmentType: SegmentType;
  toolArgs?: Record<string, unknown>;
  setDisplayedContent: (html: string) => void;
  getTimingProfile: () => TimingProfile;
  onDone: () => void;
}

const RESULT_TIMEOUT = 10_000; // 10s before we flush without result

export async function animateTool(opts: ToolAnimateOptions): Promise<void> {
  const {
    contentRef, completeRef, cancelRef,
    segmentType, toolArgs,
    setDisplayedContent, getTimingProfile, onDone,
  } = opts;

  const entry = lookup(segmentType);
  const strategy = entry.createStrategy(segmentType, toolArgs);

  // ── Build adapter: ActiveChunkStrategy → ChunkParser ──
  const adapter = createAdapter(strategy, entry, toolArgs);

  // ── Build reveal options from pressure + catalog speed ──
  const revealOptions = buildRevealOptions(entry, getTimingProfile);

  // ── Handle awaitsResult: wait for content, then reveal through the adapter ──
  if (entry.awaitsResult) {
    await runWithResultHolding(
      contentRef, completeRef, cancelRef,
      strategy, adapter, entry,
      setDisplayedContent, getTimingProfile, revealOptions,
    );
  } else {
    // Non-awaiting tools: reveal directly (strategy emits as content arrives)
    await entry.revealController.run(
      contentRef, setDisplayedContent, cancelRef, completeRef, revealOptions,
    );
  }

  onDone();
}

// =============================================================================
// ADAPTER: ActiveChunkStrategy → ChunkParser
// =============================================================================

/**
 * Bridge between ActiveChunkStrategy and the existing ChunkParser interface
 * used by orchestrateReveal(). The adapter:
 * 1. Feeds only NEW content (delta) to the strategy
 * 2. Applies transform and renderer to each chunk from strategy.next()
 * 3. Returns display-ready ParsedChunks to the orchestrator
 */
function createAdapter(
  strategy: ActiveChunkStrategy,
  entry: CatalogEntry,
  toolArgs?: Record<string, unknown>,
): ChunkParser {
  return {
    feed(content: string, prevLength: number): ParsedChunk[] {
      // Feed only the delta to the strategy
      if (content.length > prevLength) {
        strategy.onContent(content.slice(prevLength));
      }

      // Drain all ready chunks, applying transform + render
      const result: ParsedChunk[] = [];
      let chunk = strategy.next();
      while (chunk) {
        const transformed = entry.transform ? entry.transform(chunk, toolArgs) : chunk;
        const html = renderChunkToText(transformed);
        result.push({ text: html });
        chunk = strategy.next();
      }
      return result;
    },

    flush(): ParsedChunk[] {
      // Feed any remaining content
      strategy.onContent('');
      const flushed = strategy.flush();
      return flushed.map(chunk => {
        const transformed = entry.transform ? entry.transform(chunk, toolArgs) : chunk;
        return { text: renderChunkToText(transformed) };
      });
    },
  };
}

/**
 * Convert a tagged chunk to display text using the entry's renderer.
 */
function renderChunkToText(chunk: TaggedChunk): string {
  // For line-by-line rendering, each chunk is one line
  return chunk.content;
}

// =============================================================================
// RESULT HOLDING
// =============================================================================

/**
 * For awaitsResult tools: wait until result content is available, signal the
 * strategy, then reveal through the catalog adapter/parser.
 */
async function runWithResultHolding(
  contentRef: { current: string },
  completeRef: { current: boolean },
  cancelRef: { current: boolean },
  strategy: ActiveChunkStrategy,
  adapter: ChunkParser,
  entry: CatalogEntry,
  setDisplayedContent: (html: string) => void,
  getTimingProfile: () => TimingProfile,
  revealOptions: RevealOptions,
): Promise<void> {
  const startTime = Date.now();
  let timedOut = false;

  // Poll until complete or timeout
  while (!completeRef.current && !cancelRef.current) {
    // Check timeout
    if (Date.now() - startTime > RESULT_TIMEOUT) {
      timedOut = true;
      break;
    }

    await sleep(30);
  }

  if (cancelRef.current) return;

  // Signal result — this releases the held chunk
  if (completeRef.current || timedOut) {
    strategy.onResult(contentRef.current);
  }

  // Now reveal using the shared orchestrator with the strategy adapter as the
  // parser. The first feed() call parses semantic chunks into the reveal queue.
  const revealProfile = getTimingProfile();
  const finalOptions: RevealOptions = {
    ...revealOptions,
    instantReveal: revealProfile.instantReveal || revealOptions.instantReveal,
    parser: adapter,
  };

  await entry.revealController.run(
    contentRef, setDisplayedContent, cancelRef, completeRef, finalOptions,
  );
}

// =============================================================================
// REVEAL OPTIONS
// =============================================================================

/**
 * Build RevealOptions from the catalog entry's speed override and current pressure.
 */
function buildRevealOptions(entry: CatalogEntry, getTimingProfile: () => TimingProfile): RevealOptions {
  const profile = getTimingProfile();

  if (entry.speed === 'fast') {
    return {
      speedFast: 1,
      speedSlow: 1,
      batchSizeFast: 5,
      interChunkPause: profile.interChunkPause,
      instantReveal: profile.instantReveal,
    };
  }

  if (entry.speed === 'slow') {
    return {
      speedFast: profile.speedFast,
      speedSlow: profile.speedSlow,
      batchSizeFast: profile.batchSizeFast,
      interChunkPause: profile.interChunkPause,
      instantReveal: profile.instantReveal,
    };
  }

  // No override — use pressure defaults
  return {
    speedFast: profile.speedFast,
    speedSlow: profile.speedSlow,
    batchSizeFast: profile.batchSizeFast,
    interChunkPause: profile.interChunkPause,
    instantReveal: profile.instantReveal,
  };
}
