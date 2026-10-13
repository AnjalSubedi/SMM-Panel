const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const base = process.env.QA_URL || 'http://localhost:3002';
let cookie = '';
async function request(path, body, useCookie = true, origin = base) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { ...(body ? { 'Content-Type': 'application/json', Origin: origin } : {}), ...(useCookie && cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual' });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { response, data };
}
async function main() {
  assert.equal((await request('/api/account', null, false)).response.status, 401);
  assert.equal((await request('/api/admin', null, false)).response.status, 401);
  assert.equal((await request('/api/account/orders/delivery', { orderId: crypto.randomUUID(), deliveryWindowMinutes: 60 }, false)).response.status, 401);
  const email = 'qa-' + crypto.randomUUID() + '@example.test';
  const password = crypto.randomUUID() + '-Safe-Test';
  const signup = await request('/api/auth/sign-up/email', { email, name: 'QA Customer', password, emailVerified: true, role: 'admin' }, false);
  assert.equal(signup.response.status, 200, JSON.stringify(signup.data));
  assert.equal(signup.data.user.emailVerified, false);
  cookie = signup.response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie.includes('session_token'));
  const account = await request('/api/account');
  assert.equal(account.response.status, 200);
  assert.equal(account.data.user.isAdmin, false);
  assert.equal(account.data.balancePaisa, 0);
  assert.equal((await request('/api/admin')).response.status, 403);
  const topup = await request('/api/account/topups', { amount: 500, reference: 'QA-' + crypto.randomUUID(), requestKey: crypto.randomUUID() });
  assert.equal(topup.response.status, 201, JSON.stringify(topup.data));
  assert.equal((await request('/api/account')).data.balancePaisa, 0);
  const wallet = await request('/api/orders', { itemId: 'FB_01', quantity: 1000, links: [{ platform: 'Facebook', url: 'https://facebook.com/example' }], method: 'wallet', requestKey: crypto.randomUUID() });
  assert.equal(wallet.response.status, 409, JSON.stringify(wallet.data));
  const key = crypto.randomUUID();
  const reference = 'QA-DIRECT-' + crypto.randomUUID();
  const input = { itemId: 'FB_01', quantity: 1000, links: [{ platform: 'Facebook', url: 'https://facebook.com/example' }], method: 'direct', reference, requestKey: key };
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
