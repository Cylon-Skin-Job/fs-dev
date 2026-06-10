/**
 * @module assistant-parts
 * @role Convert persisted assistant parts into stream-renderable segments.
 */

import type { AssistantPart, StreamSegment } from '../../types';
import { toolNameToSegmentType, SEGMENT_ICONS } from '../instructions';

interface SegmentConversionContext {
  isTerminal?: boolean;
  isLastPart?: boolean;
}

export function convertPartToSegment(part: AssistantPart, context: SegmentConversionContext = {}): StreamSegment {
  const complete = Boolean(context.isTerminal || !context.isLastPart);

  if (part.type === 'text') {
    return { type: 'text', content: part.content, complete };
  }

  if (part.type === 'think') {
    return { type: 'think', content: part.content, complete };
  }

  const segType = toolNameToSegmentType(part.name);
  const info = SEGMENT_ICONS[segType];
  const toolComplete = Boolean(
    context.isTerminal ||
    part.result.output ||
    part.result.statusMessage ||
    part.result.display?.length ||
    part.result.error ||
    part.result.isError,
  );

  return {
    type: segType,
    content: part.result.output || '',
    toolCallId: part.toolCallId,
    icon: info?.icon,
    toolArgs: part.arguments,
    toolDisplay: part.result.display,
    toolStatus: part.result.statusMessage,
    returnedDiff: part.result.returnedDiff,
    isError: !!part.result.error || !!part.result.isError,
    complete: toolComplete,
  };
}
