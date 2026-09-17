import assert from 'node:assert/strict';

const origin = process.env.TEST_ORIGIN || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname))
  throw new Error('Local tests only.');

for (const path of ['/', '/api/health']) {
  const response = await fetch(origin + path);
  assert.equal(response.status, 200, path);
  const csp = response.headers.get('content-security-policy') || '';
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self' 'nonce-[^']+'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(response.headers.get('strict-transport-security') || '', /max-age=63072000/);
  if (path === '/') {
    const html = await response.text();
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    assert(nonce);
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)];
    assert(scripts.length > 0);
    assert(scripts.every((match) => match[1].includes(`nonce="${nonce}"`)));
  }
}
console.log('2 application security-header scenarios passed');
