/**
 * Reveal Orchestrator — shared animation engine for all tool types.
 *
 * This is the render loop. It:
 * 1. Feeds content to the parser as tokens stream in
 * 2. Parser returns complete, transformed chunks into the buffer
 * 3. Pulls the next chunk from the buffer
 * 4. Checks if chunk+1 exists in the buffer:
 *    - Yes → type at FAST speed (1ms per char)
 *    - No  → type at SLOW speed (6ms per char)
 * 5. When chunk is done, check buffer for next
 * 6. When completeRef is true (closing tag) and buffer is empty → done
 *
 * The parser is content-type-specific. The orchestrator is shared.
 */

import { INTER_CHUNK_PAUSE } from '../timing';
import type { ChunkParser, ParsedChunk, RevealOptions } from './types';

// Defaults — used when no RevealOptions are provided (backlog normal).
const DEFAULT_SPEED_FAST = 1;  // ms per char
const DEFAULT_SPEED_SLOW = 6;  // ms per char
const DEFAULT_BATCH_SIZE_FAST = 5;  // chars per tick at fast speed
const POLL_INTERVAL = 30;   // ms to wait when buffer is empty
const FLUSH_TIMEOUT = 150;  // ms before flushing partial content from parser
const LINE_END_HOLD = 15;   // ms minimum speed for last 2 chars before \n (universal rhythm)

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Type text character by character, calling onChar after each batch.
 * batchSize controls how many chars are emitted per tick.
 */
async function typeChunk(
  text: string,
  msPerChar: number,
  batchSize: number,
  onChar: (typed: string) => void,
  cancelRef: { current: boolean },
): Promise<void> {
  let i = 0;
  while (i < text.length && !cancelRef.current) {
    const end = Math.min(i + batchSize, text.length);
    onChar(text.slice(i, end));
    i = end;
    if (i < text.length) {
      // Line-end deceleration: slow down for last 2 chars before a newline.
      // This gives visual rhythm — lines feel written, not pasted.
      const nextNewline = text.indexOf('\n', i);
      const charsToNewline = nextNewline === -1 ? Infinity : nextNewline - i;
      const effectiveSpeed = charsToNewline <= 2
        ? Math.max(msPerChar, LINE_END_HOLD)
        : msPerChar;
      await sleep(effectiveSpeed);
    }
  }
}

export async function orchestrateReveal(
  contentRef: { current: string },
  setDisplayed: (content: string) => void,
  cancelRef: { current: boolean },
  completeRef: { current: boolean },
  parser: ChunkParser,
  options?: RevealOptions,
): Promise<void> {
  // ── Resolve options with defaults ──
  const speedFast = options?.speedFast ?? DEFAULT_SPEED_FAST;
  const speedSlow = options?.speedSlow ?? DEFAULT_SPEED_SLOW;
  const batchFast = options?.batchSizeFast ?? DEFAULT_BATCH_SIZE_FAST;
  const chunkPause = options?.interChunkPause ?? INTER_CHUNK_PAUSE;

  const buffer: ParsedChunk[] = [];
  let bufferCursor = 0;   // next chunk to render
  let displayed = '';     // parsed/render-ready content displayed so far
  let lastFedLength = 0;  // content length last fed to parser
  let stallStart = 0;     // timestamp when buffer became empty with pending content

  while (!cancelRef.current) {
    // ── Step 1: Feed new content to parser ──
    const content = contentRef.current;
    if (content.length > lastFedLength) {
      const newChunks = parser.feed(content, lastFedLength);
      for (const chunk of newChunks) {
        buffer.push(chunk);
      }
      lastFedLength = content.length;
    }

    // ── Step 2: Is there a chunk ready to render? ──
    if (bufferCursor < buffer.length) {
      stallStart = 0; // reset stall timer when we have chunks
      const chunk = buffer[bufferCursor];
      const nextChunkReady = bufferCursor + 1 < buffer.length;
      const speed = nextChunkReady ? speedFast : speedSlow;
      const batch = nextChunkReady ? batchFast : 1;

      // ── Step 3: Type this chunk ──
      await typeChunk(chunk.text, speed, batch, (typed) => {
        displayed += typed;
        setDisplayed(displayed);
      }, cancelRef);

      bufferCursor++;

      if (!cancelRef.current && chunkPause > 0) {
        await sleep(chunkPause);
      }
    } else {
      // ── Step 4: Buffer empty — wait or exit ──

      // If closing tag arrived, flush any trailing content and exit
      if (completeRef.current) {
        // Feed one last time to catch any trailing content without a newline
        const finalContent = contentRef.current;
        if (finalContent.length > lastFedLength) {
          const lastChunks = parser.feed(finalContent, lastFedLength);
          for (const chunk of lastChunks) {
            buffer.push(chunk);
          }
          lastFedLength = finalContent.length;
        }

        if (parser.flush) {
          const flushed = parser.flush(finalContent);
          for (const chunk of flushed) {
            buffer.push(chunk);
          }
        } else {
          // Fallback for parsers without flush support. Most parsers provide
          // flush(), especially when their chunk text may differ from source.
          if (displayed.length < finalContent.length) {
            const tail = finalContent.slice(displayed.length);
            if (tail.length > 0) {
              buffer.push({ text: tail });
            }
          }
        }

        // Render any remaining buffered chunks
        while (bufferCursor < buffer.length && !cancelRef.current) {
          const chunk = buffer[bufferCursor];
          await typeChunk(chunk.text, speedSlow, 1, (typed) => {
            displayed += typed;
            setDisplayed(displayed);
          }, cancelRef);
          bufferCursor++;
        }

        // Done
        break;
      }

      // ── Step 4b: Flush stalled partial content ──
      // If the parser is holding back content (e.g., no \n yet) and
      // we've been waiting longer than FLUSH_TIMEOUT, force-flush it.
      const hasUnrenderedContent = displayed.length < contentRef.current.length
        || lastFedLength < contentRef.current.length;
      if (hasUnrenderedContent && parser.flush) {
        if (stallStart === 0) {
          stallStart = Date.now();
        } else if (Date.now() - stallStart >= FLUSH_TIMEOUT) {
          const flushed = parser.flush(contentRef.current);
          for (const chunk of flushed) {
            buffer.push(chunk);
          }
          stallStart = 0;
          // Skip the sleep — go straight to rendering the flushed chunk
          continue;
        }
      } else {
        stallStart = 0;
      }

      // Not complete yet — wait for more tokens
      await sleep(POLL_INTERVAL);
    }
  }

  // Ensure final parsed content is fully displayed without replacing transformed
  // chunks with raw transport text.
  setDisplayed(displayed || contentRef.current);
}
