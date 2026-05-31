import type { TaggedChunk } from '../../../types/tagged-chunk';
import type { ActiveChunkStrategy } from '../../../types/active-strategy';
import { formatSearchResultChunk, parseSearchWebOutput } from '../../tool-output';

export function createWebSearchChunkStrategy(parent: string): ActiveChunkStrategy {
  let accumulated = '';
  let resultReceived = false;
  let parsed = false;
  const ready: TaggedChunk[] = [];

  function parseOnce() {
    if (parsed) return;
    parsed = true;
    for (const result of parseSearchWebOutput(accumulated)) {
      ready.push({
        content: formatSearchResultChunk(result),
        block: 'text',
        parent,
        position: 'complete',
      });
    }
  }

  return {
    onContent(data: string) {
      accumulated += data;
    },

    onResult() {
      resultReceived = true;
    },

    next(): TaggedChunk | null {
      if (!resultReceived) return null;
      parseOnce();
      return ready.length > 0 ? ready.shift()! : null;
    },

    flush(): TaggedChunk[] {
      resultReceived = true;
      parseOnce();
      const chunks = [...ready];
      ready.length = 0;
      return chunks;
    },
  };
}
