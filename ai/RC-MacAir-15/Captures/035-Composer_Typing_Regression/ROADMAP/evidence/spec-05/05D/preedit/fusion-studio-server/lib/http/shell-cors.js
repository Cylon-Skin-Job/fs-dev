'use strict';

const SHELL_ORIGIN = 'fusion-shell://app';
const ALLOWED_METHODS = 'GET,HEAD,POST,PUT,DELETE,OPTIONS';
const ALLOWED_HEADERS = 'Content-Type';

function createShellCorsMiddleware() {
  return function shellCors(req, res, next) {
    if (req.headers.origin !== SHELL_ORIGIN) {
      next();
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', SHELL_ORIGIN);
    res.vary('Origin');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }
    next();
  };
}

module.exports = {
  ALLOWED_HEADERS,
  ALLOWED_METHODS,
  SHELL_ORIGIN,
  createShellCorsMiddleware,
};
