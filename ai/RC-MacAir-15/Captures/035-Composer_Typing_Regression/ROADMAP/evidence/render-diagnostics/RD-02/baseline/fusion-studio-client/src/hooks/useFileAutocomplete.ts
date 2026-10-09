import { useMemo } from 'react';
import { getFileAutocompleteMatch, applyFileAutocompleteMatch } from '../lib/chat-file-links/file-autocomplete-match';
import { useChatFileLinkStore } from '../state/chatFileLinkStore';

export function useFileAutocomplete(text: string, cursorIndex: number) {
  const candidates = useChatFileLinkStore((state) => state.autocompleteCandidates);

  const match = useMemo(
    () => getFileAutocompleteMatch(text, cursorIndex, candidates),
    [text, cursorIndex, candidates],
  );

  return {
    match,
    accept: () => match ? applyFileAutocompleteMatch(text, match) : text,
  };
}
