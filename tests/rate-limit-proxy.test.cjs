const assert = require('node:assert/strict');
const { test } = require('node:test');
const { rateLimitClientIp } = require('../dist/middleware/rateLimit');

function request(forwarded, remoteAddress = '127.0.0.1') {
  return {
    get(name) {
      return name === 'x-forwarded-for' ? forwarded : undefined;
    },
    socket: { remoteAddress },
    ip: remoteAddress,
  };
}

test('rate-limit key uses the closest forwarded address, not a spoofable left-most value', () => {
  assert.equal(rateLimitClientIp(request('203.0.113.99, 198.51.100.24')), '198.51.100.24');
  assert.equal(rateLimitClientIp(request(' 198.51.100.24 ')), '198.51.100.24');
  assert.equal(rateLimitClientIp(request(undefined, '127.0.0.1')), '127.0.0.1');
});
