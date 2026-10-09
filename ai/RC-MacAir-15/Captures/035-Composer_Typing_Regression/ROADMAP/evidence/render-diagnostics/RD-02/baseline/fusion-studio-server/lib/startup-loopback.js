'use strict';

const LOOPBACK_HOST = '127.0.0.1';

function parseLoopbackPort(value) {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,4})$/.test(value)) {
    throw new TypeError('PORT must be a canonical integer from 0 through 65535');
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError('PORT must be a canonical integer from 0 through 65535');
  }
  return port;
}

function validateLoopbackHost(host) {
  if (host !== LOOPBACK_HOST) {
    throw new TypeError('Fusion server must bind exact IPv4 loopback');
  }
  return host;
}

module.exports = { LOOPBACK_HOST, parseLoopbackPort, validateLoopbackHost };
