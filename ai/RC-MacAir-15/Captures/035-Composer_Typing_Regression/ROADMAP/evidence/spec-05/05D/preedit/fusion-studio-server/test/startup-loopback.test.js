'use strict';

const {
  LOOPBACK_HOST,
  parseLoopbackPort,
  validateLoopbackHost,
} = require('../lib/startup-loopback');

describe('exact IPv4 loopback startup authority', () => {
  test('accepts OS assignment and canonical loopback ports', () => {
    expect(LOOPBACK_HOST).toBe('127.0.0.1');
    expect(parseLoopbackPort('0')).toBe(0);
    expect(parseLoopbackPort('3001')).toBe(3001);
    expect(parseLoopbackPort('65535')).toBe(65535);
    expect(validateLoopbackHost('127.0.0.1')).toBe('127.0.0.1');
  });

  test.each(['', '01', '-1', '65536', '3001junk', 'localhost', ' 3001'])('rejects invalid port %p', (value) => {
    expect(() => parseLoopbackPort(value)).toThrow(/PORT/);
  });

  test.each(['localhost', '::1', '0.0.0.0', '192.168.1.5', undefined])('rejects non-exact host %p', (host) => {
    expect(() => validateLoopbackHost(host)).toThrow(/exact IPv4 loopback/);
  });
});
