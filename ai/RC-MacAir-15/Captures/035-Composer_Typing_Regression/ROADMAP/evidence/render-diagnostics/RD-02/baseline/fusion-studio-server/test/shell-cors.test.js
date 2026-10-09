'use strict';

const {
  SHELL_ORIGIN,
  createShellCorsMiddleware,
} = require('../lib/http/shell-cors');

function createResponse() {
  const headers = new Map();
  return {
    headers,
    statusCode: null,
    ended: false,
    setHeader: (name, value) => headers.set(name, value),
    vary: (value) => headers.set('Vary', value),
    status(code) { this.statusCode = code; return this; },
    end() { this.ended = true; },
  };
}

describe('trusted shell CORS boundary', () => {
  test('names only the exact shell origin', () => {
    const middleware = createShellCorsMiddleware();
    const response = createResponse();
    let next = 0;
    middleware({ method: 'GET', headers: { origin: SHELL_ORIGIN } }, response, () => { next += 1; });
    expect(next).toBe(1);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(SHELL_ORIGIN);
    expect([...response.headers.values()].join(' ')).not.toMatch(/localhost|\*/);
  });

  test.each([undefined, 'fusion-studio://wiki-viewer', 'http://localhost:3001', 'https://example.com'])('does not grant origin %p', (origin) => {
    const middleware = createShellCorsMiddleware();
    const response = createResponse();
    let next = 0;
    middleware({ method: 'GET', headers: { origin } }, response, () => { next += 1; });
    expect(next).toBe(1);
    expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  test('answers exact shell preflight without reflecting request values', () => {
    const middleware = createShellCorsMiddleware();
    const response = createResponse();
    middleware({
      method: 'OPTIONS',
      headers: {
        origin: SHELL_ORIGIN,
        'access-control-request-headers': 'X-Untrusted',
      },
    }, response, () => { throw new Error('preflight continued'); });
    expect(response.statusCode).toBe(204);
    expect(response.ended).toBe(true);
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });
});
