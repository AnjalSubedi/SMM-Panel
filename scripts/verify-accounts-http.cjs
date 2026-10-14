const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const base = process.env.QA_URL || 'http://localhost:3002';
let cookie = '';
const consent = { termsAccepted: true, termsVersion: '2026-10-14', termsLanguage: 'en' };
async function request(path, body, useCookie = true, origin = base) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(useCookie && cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual' });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { response, data };
}
async function main() {
  const login = await request('/login', null, false);
  assert.equal(login.response.headers.get('x-frame-options'), 'DENY');
  assert.equal(login.response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(login.response.headers.get('referrer-policy'), 'no-referrer');
  assert.match(login.response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(login.response.headers.get('x-powered-by'), null);
  for (const path of ['/api/orders', '/api/auth/sign-in/email']) {
    const oversized = await fetch(base + path, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(20001) }) });
    assert.equal(oversized.status, 413, path + ' rejects oversized payloads');
  }
  const malformed = await fetch(base + '/api/orders', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: new Uint8Array([255]) });
  assert.equal(malformed.status, 400);
  assert.equal((await request('/api/account', null, false)).response.status, 401);
  assert.equal((await request('/api/admin', null, false)).response.status, 401);
  assert.equal((await request('/api/account/notifications', null, false)).response.status, 401);
  assert.equal((await request('/api/account/notifications', { ids: ['a'.repeat(64)] }, false)).response.status, 401);
  assert.equal((await request('/api/account/orders/delivery', { orderId: crypto.randomUUID(), deliveryWindowMinutes: 60 }, false)).response.status, 401);
  const email = 'qa-' + crypto.randomUUID() + '@example.test';
  const password = crypto.randomUUID() + '-Safe-Test';
  let signup = await request('/api/auth/sign-up/email', { email, name: 'QA Customer', password, emailVerified: true, role: 'admin' }, false);
  if (process.env.NODE_ENV === 'production') {
    assert.equal(signup.response.status, 400); assert.equal(signup.data.code, 'EMAIL_PASSWORD_SIGN_UP_DISABLED');
    await require('./qa-user.cjs').seedQaUser('QA Customer', email, password);
    signup = await request('/api/auth/sign-in/email', { email, password }, false);
  }
  assert.equal(signup.response.status, 200, JSON.stringify(signup.data));
  assert.equal(signup.data.user.emailVerified, process.env.NODE_ENV === 'production');
  cookie = signup.response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie.includes('session_token'));
  assert.ok(signup.response.headers.getSetCookie().filter(value=>value.includes('session_token')).every(value=>/httponly/i.test(value)&&/samesite=lax/i.test(value)));
  assert.match(signup.response.headers.get('cache-control'), /private.*no-store/);
  const badProfile = await request('/api/auth/update-user', { name: 'x'.repeat(81) });
  assert.equal(badProfile.response.status, 400, 'Profile length must be checked on the server');
  assert.equal((await request('/api/auth/update-user', { image: 'javascript:alert(1)' })).response.status, 400);
  assert.equal((await request('/api/auth/update-user', { name: 'QA Customer', emailVerified: true, role: 'admin' })).response.status, 200);
  const account = await request('/api/account');
  assert.equal(account.response.status, 200);
  assert.equal(account.data.user.isAdmin, false);
  assert.equal(account.data.user.emailVerified, process.env.NODE_ENV === 'production', 'Profile updates cannot forge verification');
  assert.match(account.response.headers.get('cache-control'), /private.*no-store/);
  assert.equal(account.data.balancePaisa, 0);
  assert.equal((await request('/api/admin')).response.status, 403);
  const home = await request('/');
  assert.equal(home.response.status, 307); assert.equal(home.response.headers.get('location'), '/account');
  assert.equal((await request('/services')).response.status, 200);
  assert.equal((await request('/api/account/notifications', { ids: ['a'.repeat(64)] }, true, 'https://evil.invalid')).response.status, 403);
  assert.equal((await request('/api/account/notifications', { ids: ['invalid'] })).response.status, 400);
  const topup = await request('/api/account/topups', { ...consent, amount: 500, reference: 'QA-' + crypto.randomUUID(), requestKey: crypto.randomUUID() });
  assert.equal(topup.response.status, 201, JSON.stringify(topup.data));
  assert.equal((await request('/api/account')).data.balancePaisa, 0);
  const wallet = await request('/api/orders', { ...consent, itemId: 'FB_01', quantity: 1000, links: [{ platform: 'Facebook', url: 'https://facebook.com/example' }], method: 'wallet', requestKey: crypto.randomUUID() });
  assert.equal(wallet.response.status, 409, JSON.stringify(wallet.data));
  const key = crypto.randomUUID();
  const reference = 'QA-DIRECT-' + crypto.randomUUID();
  const input = { ...consent, itemId: 'FB_01', quantity: 1000, links: [{ platform: 'Facebook', url: 'https://facebook.com/example' }], method: 'direct', reference, requestKey: key };
  const deceptive = { ...input, reference: 'DECEPTIVE-' + crypto.randomUUID(), requestKey: crypto.randomUUID(), links: [{ platform: 'Facebook', url: 'https://facebook.com@evil.com/page' }] };
  assert.equal((await request('/api/orders', deceptive)).response.status, 400);
  const { termsAccepted, termsVersion, termsLanguage, ...withoutTerms } = input;
  assert.equal((await request('/api/orders', withoutTerms)).response.status, 400, 'Missing acceptance rejected by API');
  assert.equal((await request('/api/orders', { ...input, termsAccepted: false })).response.status, 400);
  assert.equal((await request('/api/orders', { ...input, termsVersion: 'old-version' })).response.status, 400);
  assert.equal((await request('/api/account/topups', { amount: 100, reference: 'MISSING-CONSENT', requestKey: crypto.randomUUID() })).response.status, 400);
  const direct = await request('/api/orders', input);
  assert.equal(direct.response.status, 201, JSON.stringify(direct.data));
  assert.equal(direct.data.amountPaisa, 14900);
  assert.equal((await request('/api/account/orders/delivery', { orderId: direct.data.id, deliveryWindowMinutes: 60 })).response.status, 409, 'Pending payment cannot unlock delivery selection');
  assert.equal((await request('/api/account/orders/delivery', { orderId: direct.data.id, deliveryWindowMinutes: 60 }, true, 'https://evil.invalid')).response.status, 403);
  assert.equal((await request('/api/account/orders/delivery', { orderId: direct.data.id, deliveryWindowMinutes: 60, runs: 1000 })).response.status, 400, 'Client cannot override batch counts');
  assert.equal((await request('/api/orders', input)).data.id, direct.data.id);
  assert.equal((await request('/api/orders', { ...input, requestKey: crypto.randomUUID() })).response.status, 409);
  assert.equal((await request('/api/orders', { ...input, price: 1 })).response.status, 400);
  assert.equal((await request('/api/account/topups', { amount: 500, reference: 'QA-CSRF-' + crypto.randomUUID(), requestKey: crypto.randomUUID() }, true, 'https://evil.invalid')).response.status, 403);
  const own = await request('/api/account');
  assert.equal(own.data.orders.length, 1);
  assert.equal(own.data.orders[0].status, 'awaiting_payment');
  const signout = await request('/api/auth/sign-out', {});
  assert.equal(signout.response.status, 200);
  assert.equal((await request('/api/account')).response.status, 401, 'Revoked session must stop access');
  console.log('HTTP checks passed: email registration, session cookies, forged verification/role blocked, private account access, admin 403, pending deposits, direct checkout, wallet protection, replay prevention, server pricing, CSRF, logout revocation.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
