import type { ChatFileAutocompleteCandidate } from './file-link-types';

export interface FileAutocompleteMatch {
  candidate: ChatFileAutocompleteCandidate;
  token: string;
  tokenStart: number;
  replacement: string;
  ghostSuffix: string;
}

function tokenBeforeCursor(text: string, cursorIndex: number): { token: string; tokenStart: number } | null {
  const beforeCursor = text.slice(0, cursorIndex);
  const match = beforeCursor.match(/(^|\s)([^\s@/\\]+)$/);
  if (!match) return null;
  const token = match[2];
  if (token.length < 2) return null;
  return {
    token,
    tokenStart: cursorIndex - token.length,
  };
}

function sourceRank(candidate: ChatFileAutocompleteCandidate): number {
  if (candidate.source === 'open-tab') return 0;
  if (candidate.source === 'file-mutation') return 1;
  return 2;
}

export function getFileAutocompleteMatch(
  text: string,
  cursorIndex: number,
  candidates: ChatFileAutocompleteCandidate[],
): FileAutocompleteMatch | null {
  if (cursorIndex !== text.length) return null;

  const tokenInfo = tokenBeforeCursor(text, cursorIndex);
  if (!tokenInfo) return null;

  const tokenLower = tokenInfo.token.toLowerCase();
  const matches = candidates
    .map((candidate) => {
      const basenameLower = candidate.basename.toLowerCase();
      const index = basenameLower.indexOf(tokenLower);
      if (index < 0 || basenameLower === tokenLower) return null;
      return { candidate, index };
    })
    .filter((match): match is { candidate: ChatFileAutocompleteCandidate; index: number } => Boolean(match))
    .sort((a, b) => {
      const prefixDelta = Number(a.index > 0) - Number(b.index > 0);
      if (prefixDelta !== 0) return prefixDelta;
      const sourceDelta = sourceRank(a.candidate) - sourceRank(b.candidate);
      if (sourceDelta !== 0) return sourceDelta;
      const caseDelta = Number(!a.candidate.basename.startsWith(tokenInfo.token))
        - Number(!b.candidate.basename.startsWith(tokenInfo.token));
      if (caseDelta !== 0) return caseDelta;
      return (b.candidate.openedAt || b.candidate.mentionedAt || 0)
        - (a.candidate.openedAt || a.candidate.mentionedAt || 0);
    });

  const best = matches[0]?.candidate;
  if (!best) return null;

  return {
    candidate: best,
    token: tokenInfo.token,
    tokenStart: tokenInfo.tokenStart,
    replacement: best.basename,
    ghostSuffix: best.basename.slice(tokenInfo.token.length),
  };
}

export function applyFileAutocompleteMatch(text: string, match: FileAutocompleteMatch): string {
  return `${text.slice(0, match.tokenStart)}${match.replacement} ${text.slice(match.tokenStart + match.token.length)}`;
}
