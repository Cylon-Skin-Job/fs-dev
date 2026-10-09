type SearchToken =
  | { type: 'term'; value: string }
  | { type: 'op'; value: 'AND' | 'OR' | 'NOT' }
  | { type: 'lparen' }
  | { type: 'rparen' };

type SearchNode =
  | { type: 'term'; value: string }
  | { type: 'not'; child: SearchNode }
  | { type: 'and' | 'or'; left: SearchNode; right: SearchNode };

export interface SearchRankFields {
  title: string;
  location: string;
  body: string;
}

export interface SearchRank {
  matches: boolean;
  score: number;
}

function readQuotedTerm(query: string, start: number): { value: string; next: number } {
  let value = '';
  let index = start + 1;

  while (index < query.length) {
    const char = query[index];
    if (char === '\\' && query[index + 1] === '"') {
      value += '"';
      index += 2;
      continue;
    }
    if (char === '"') {
      return { value, next: index + 1 };
    }
    value += char;
    index += 1;
  }

  return { value, next: index };
}

function tokenizeSearchQuery(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  let index = 0;

  while (index < query.length) {
    const char = query[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '"') {
      const quoted = readQuotedTerm(query, index);
      if (quoted.value.trim()) {
        tokens.push({ type: 'term', value: quoted.value.toLowerCase() });
      }
      index = quoted.next;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'lparen' });
      index += 1;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'rparen' });
      index += 1;
      continue;
    }

    let value = '';
    while (index < query.length && !/\s|\(|\)|"/.test(query[index])) {
      value += query[index];
      index += 1;
    }

    const operator = value.toUpperCase();
    if (operator === 'AND' || operator === 'OR' || operator === 'NOT') {
      tokens.push({ type: 'op', value: operator });
    } else if (value) {
      tokens.push({ type: 'term', value: value.toLowerCase() });
    }
  }

  return insertImplicitAnd(tokens);
}

function endsOperand(token: SearchToken): boolean {
  return token.type === 'term' || token.type === 'rparen';
}

function startsOperand(token: SearchToken): boolean {
  return token.type === 'term' || token.type === 'lparen' || (token.type === 'op' && token.value === 'NOT');
}

function insertImplicitAnd(tokens: SearchToken[]): SearchToken[] {
  const result: SearchToken[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];
    result.push(token);

    if (next && endsOperand(token) && startsOperand(next)) {
      result.push({ type: 'op', value: 'AND' });
    }
  }

  return result;
}

function parseSearchTokens(tokens: SearchToken[]): SearchNode | null {
  let index = 0;

  function peek(): SearchToken | undefined {
    return tokens[index];
  }

  function consume(): SearchToken | undefined {
    const token = tokens[index];
    index += 1;
    return token;
  }

  function precedence(token: SearchToken | undefined): number {
    if (!token || token.type !== 'op') return 0;
    if (token.value === 'OR') return 1;
    if (token.value === 'AND') return 2;
    return 0;
  }

  function parseUnary(): SearchNode | null {
    const token = peek();
    if (!token) return null;

    if (token.type === 'op' && token.value === 'NOT') {
      consume();
      const child = parseUnary();
      return child ? { type: 'not', child } : null;
    }

    if (token.type === 'op') {
      consume();
      return parseUnary();
    }

    if (token.type === 'lparen') {
      consume();
      const expression = parseExpression(1);
      if (peek()?.type === 'rparen') consume();
      return expression;
    }

    if (token.type === 'term') {
      consume();
      return { type: 'term', value: token.value };
    }

    consume();
    return null;
  }

  function parseExpression(minPrecedence: number): SearchNode | null {
    let left = parseUnary();
    if (!left) return null;

    while (true) {
      const operator = peek();
      const operatorPrecedence = precedence(operator);
      if (operatorPrecedence < minPrecedence || operator?.type !== 'op' || operator.value === 'NOT') break;

      consume();
      const right = parseExpression(operatorPrecedence + 1);
      if (!right) break;
      left = {
        type: operator.value === 'OR' ? 'or' : 'and',
        left,
        right,
      };
    }

    return left;
  }

  return parseExpression(1);
}

function evaluateSearchNode(node: SearchNode, haystack: string): boolean {
  switch (node.type) {
    case 'term':
      return haystack.includes(node.value);
    case 'not':
      return !evaluateSearchNode(node.child, haystack);
    case 'and':
      return evaluateSearchNode(node.left, haystack) && evaluateSearchNode(node.right, haystack);
    case 'or':
      return evaluateSearchNode(node.left, haystack) || evaluateSearchNode(node.right, haystack);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectPositiveTerms(node: SearchNode, negated = false): string[] {
  switch (node.type) {
    case 'term':
      return negated ? [] : [node.value];
    case 'not':
      return collectPositiveTerms(node.child, true);
    case 'and':
    case 'or':
      return [
        ...collectPositiveTerms(node.left, negated),
        ...collectPositiveTerms(node.right, negated),
      ];
  }
}

function scoreField(text: string, term: string, weight: number): number {
  const normalized = text.toLowerCase();
  const index = normalized.indexOf(term);
  if (index === -1) return 0;

  const exactPhraseScore = normalized === term ? weight : 0;
  const prefixScore = normalized.startsWith(term) ? weight * 0.35 : 0;
  const boundaryScore = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term)}([^a-z0-9]|$)`, 'i').test(text)
    ? weight * 0.2
    : 0;
  const earlyScore = Math.max(0, weight * 0.15 - index);

  return weight + exactPhraseScore + prefixScore + boundaryScore + earlyScore;
}

export function rankSearchFields(fields: SearchRankFields, query: string): SearchRank {
  if (!query.trim()) return { matches: true, score: 0 };

  const tokens = tokenizeSearchQuery(query);
  const expression = parseSearchTokens(tokens);
  if (!expression) return { matches: true, score: 0 };

  const haystack = `${fields.title}\n${fields.location}\n${fields.body}`.toLowerCase();
  if (!evaluateSearchNode(expression, haystack)) {
    return { matches: false, score: 0 };
  }

  const terms = Array.from(new Set(collectPositiveTerms(expression)));
  const score = terms.reduce(
    (total, term) =>
      total +
      scoreField(fields.title, term, 1000) +
      scoreField(fields.location, term, 350) +
      scoreField(fields.body, term, 120),
    0
  );

  return { matches: true, score };
}

export function matchesSearchQuery(haystack: string, query: string): boolean {
  if (!query.trim()) return true;

  const tokens = tokenizeSearchQuery(query);
  const expression = parseSearchTokens(tokens);
  if (!expression) return true;

  return evaluateSearchNode(expression, haystack.toLowerCase());
}
