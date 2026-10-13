const fs = require('node:fs/promises');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const path = require('node:path');

const base = process.env.QA_URL || 'http://localhost:3002';
if (base !== 'http://localhost:3002') throw new Error('This suite only runs against the isolated local QA server on port 3002.');

async function main() {
  const target = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let id = 0;
  const tasks = new Map(); const errors = [];
  socket.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && tasks.has(msg.id)) { const task = tasks.get(msg.id); tasks.delete(msg.id); clearTimeout(task.timer); msg.error ? task.reject(msg.error) : task.resolve(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const request = ++id; const timer = setTimeout(() => reject(new Error('Timeout: ' + method)), 20000); tasks.set(request, { resolve, reject, timer }); socket.send(JSON.stringify({ id: request, method, params })); });
  const evaluate = async (expression) => { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const waitFor = async (expression) => { for (let attempt = 0; attempt < 80; attempt++) { if (await evaluate('Boolean(document.body) && (' + expression + ')')) return; await new Promise(resolve => setTimeout(resolve, 250)); } throw new Error('Did not become ready: ' + expression); };
  const settle = () => evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  const go = async (pathname, ready) => { await call('Page.navigate', { url: base + pathname }); await waitFor(ready); await waitFor("!!document.querySelector('header') && !document.querySelector('header .animate-pulse')"); await settle(); };
  const set = async (selector, value, select = false) => { await evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype,'value').set.call(e,${JSON.stringify(String(value))});e.dispatchEvent(new Event('${select ? 'change' : 'input'}',{bubbles:true}));})()`); await settle(); };
  const click = async (text) => { assert.equal(await evaluate(`(() => {const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!e)return false;e.click();return true;})()`), true, text); await settle(); };
  const browserPost = async (route, body) => evaluate(`fetch(${JSON.stringify(route)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(body)})}).then(async r=>({status:r.status,data:await r.json()}))`);
  const screenshot = async (name) => { await evaluate('document.fonts.ready'); const result = await call('Page.captureScreenshot', { format: 'png' }); await fs.mkdir('.qa', { recursive: true }); await fs.writeFile('.qa/' + name + '.png', Buffer.from(result.data, 'base64')); };
  const selectService = async (quantity = 1000) => {
    await set('#service-platform', 'Facebook', true); await set('#service-category', 'Followers & subscribers', true); await set('#service-boost', 'FB_01', true); await set('#quantity', quantity);
    await evaluate("document.querySelector('aside button[aria-haspopup]').click()"); await waitFor("document.querySelector('dialog')?.open");
  };
  try {
    await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable'); await call('Network.clearBrowserCookies');
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await go('/register', "!!document.querySelector('#auth-name')");
    await screenshot('register');
    const customerEmail = 'browser-' + randomUUID() + '@example.test';
    const customerPassword = randomUUID() + '-Test-Pass';
    await set('#auth-name', 'Browser Customer'); await set('#auth-email', customerEmail); await set('#auth-password', customerPassword);
    await evaluate("document.querySelector('form button:not([type])').click()");
    await waitFor("location.pathname === '/account' && document.body.textContent.includes('Welcome, Browser.')");
    await waitFor("!!document.querySelector('header') && !document.querySelector('header .animate-pulse')");
    await settle();
    await screenshot('account');
    const reference = ('BROWSER-DEPOSIT-' + randomUUID()).toUpperCase();
    await set('#deposit-reference', reference);
    await evaluate("document.querySelector('#add-funds form button:not([type])').click()");
    await waitFor("document.body.textContent.includes('Deposit submitted for review')");
    assert.equal(await evaluate("fetch('/api/account').then(r=>r.json()).then(d=>d.balancePaisa)"), 0);
    assert.equal(await evaluate("fetch('/api/admin').then(r=>r.status)"), 403);

    await go('/#calculator', "!!document.querySelector('#service-platform')");
    await selectService(1250); await click('Use account wallet');
    await waitFor("document.querySelector('dialog').textContent.includes('You need')");
    assert.equal(await evaluate("document.querySelector('dialog form button:not([type])').disabled"), true);
    await screenshot('wallet-insufficient');
    await click('Pay directly with eSewa');
    const directReference = ('BROWSER-ORDER-' + randomUUID()).toUpperCase();
    await set('#transaction-code', directReference);
    await set('#public-url-0', 'https://facebook.com/browser-example');
    await evaluate("document.querySelector('dialog form button:not([type])').click()");
    await waitFor("document.querySelector('dialog')?.textContent.includes('Payment submitted for review')");
    await screenshot('direct-payment-success');
    const directId = await evaluate("fetch('/api/account').then(r=>r.json()).then(d=>d.orders[0].id)");
    const tooEarly = await browserPost('/api/account/orders/delivery', { orderId: directId, deliveryWindowMinutes: 60 });
    assert.equal(tooEarly.status, 409, 'Timing stays locked before approval');

    // Only this disposable QA database is modified to simulate a verified owner.
    const ownerEmail = 'qa-owner@example.test';
    const ownerPassword = 'Isolated-Test-Owner-Password-2026!';
    const registerOwner = await browserPost('/api/auth/sign-up/email', { email: ownerEmail, name: 'QA Owner', password: ownerPassword });
    assert.ok([200, 422].includes(registerOwner.status), JSON.stringify(registerOwner));
    const databaseURL = new URL(process.env.QA_DATABASE_URL || '');
    if (databaseURL.hostname !== '127.0.0.1' || databaseURL.username !== 'dmnp_test' || databaseURL.pathname !== '/dmnp_qa') throw new Error('Browser tests only modify the isolated local PostgreSQL QA database.');
    const db = new Pool({ connectionString: databaseURL.toString(), max: 1 });
    try { await db.query('UPDATE "user" SET "emailVerified" = TRUE WHERE email = $1', [ownerEmail]); } finally { await db.end(); }
    const loginOwner = await browserPost('/api/auth/sign-in/email', { email: ownerEmail, password: ownerPassword });
    assert.equal(loginOwner.status, 200);
    await go('/admin', "document.body.textContent.includes('Operations dashboard')");
    await screenshot('admin');
    await evaluate(`(() => {const article=[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(reference)}));article.querySelector('input[type=checkbox]').click();const input=article.querySelector('input:not([type=checkbox])');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Verified simulated payment in isolated QA');input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle();
    await evaluate(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(reference)})).querySelector('button').click()`);
    await waitFor(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(reference)}))?.textContent.includes('Approved')`);
    await evaluate(`(() => {const article=[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directReference)}));article.querySelector('input[type=checkbox]').click();const input=article.querySelector('input:not([type=checkbox])');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Verified simulated direct payment');input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle();
    await evaluate(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directReference)})).querySelector('button').click()`);
    await waitFor(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directReference)}))?.textContent.includes('Approved')`);
    const customerLogin = await browserPost('/api/auth/sign-in/email', { email: customerEmail, password: customerPassword });
    assert.equal(customerLogin.status, 200);
    await go('/account', "document.body.textContent.includes('Welcome, Browser.')");
    assert.equal(await evaluate("fetch('/api/account').then(r=>r.json()).then(d=>d.balancePaisa)"), 50000);
    await waitFor(`!!document.querySelector('[data-delivery-order="${directId}"]')`);
    await screenshot('delivery-choice');
    await evaluate(`[...document.querySelector('[data-delivery-order="${directId}"]').querySelectorAll('label')].find(l=>l.textContent.includes('Gradual delivery')).querySelector('input').click()`); await settle();
    assert.match(await evaluate(`document.querySelector('[data-delivery-order="${directId}"]').textContent`), /5 batches of 250, every 15 minutes/);
    await call('Emulation.setDeviceMetricsOverride', { width: 320, height: 844, deviceScaleFactor: 1, mobile: true }); await settle();
    assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Delivery chooser fits a 320px viewport');
    await screenshot('delivery-choice-mobile');
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }); await settle();
    await click('Confirm gradual delivery');
    await waitFor(`!document.querySelector('[data-delivery-order="${directId}"]') && document.body.textContent.includes('Spread over 1 hour')`);
    assert.equal(await evaluate("fetch('/api/account').then(r=>r.json()).then(d=>d.balancePaisa)"), 50000, 'Choosing a timeframe does not charge the wallet');
    await go('/#calculator', "!!document.querySelector('#service-platform')");
    await selectService(1250); await click('Use account wallet');
    await waitFor("document.querySelector('dialog').textContent.includes('NPR 500')");
    await set('#public-url-0', 'https://facebook.com/browser-wallet');
    await evaluate("document.querySelector('dialog form button:not([type])').click()");
    await waitFor("document.querySelector('dialog')?.textContent.includes('Paid from your wallet')");
    assert.equal(await evaluate("fetch('/api/account').then(r=>r.json()).then(d=>d.balancePaisa)"), 31375);
    await go('/account', "document.body.textContent.includes('Payment confirmed. Choose delivery.')");
    await click('Confirm default delivery');
    await waitFor("!document.querySelector('[data-delivery-order]')");
    assert.equal(await evaluate("fetch('/api/account').then(r=>r.json()).then(d=>d.balancePaisa)"), 31375, 'Default choice also never debits again');


    await go('/account', "document.body.textContent.includes('Welcome, Browser.')"); await click('Sign out');
    await waitFor("location.pathname === '/login' && !!document.querySelector('#auth-email')");
    await waitFor("!document.querySelector('header .animate-pulse')");
    await go('/#calculator', "!!document.querySelector('#service-platform')");
    await selectService(1250); await click('Use account wallet'); await set('#public-url-0', 'https://facebook.com/saved-draft');
    await evaluate("[...document.querySelectorAll('dialog a')].find(a=>a.getAttribute('href').startsWith('/login?')).click()");
    await waitFor("location.pathname === '/login' && !!document.querySelector('#auth-email')");
    await waitFor("!document.querySelector('header .animate-pulse')");
    await screenshot('login');
    await set('#auth-email', customerEmail); await set('#auth-password', customerPassword);
    await evaluate("document.querySelector('form button:not([type])').click()");
    await waitFor("location.pathname === '/' && document.querySelector('dialog')?.open");
    assert.equal(await evaluate("document.querySelector('#public-url-0').value"), 'https://facebook.com/saved-draft');
    assert.match(await evaluate("document.querySelector('dialog').textContent"), /186.25/);
    assert.equal(await evaluate("document.querySelector('#payment-tab-wallet').getAttribute('aria-selected')"), 'true');

    await go('/account', "document.body.textContent.includes('Welcome, Browser.')");
    for (const width of [390, 320, 768]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true }); await settle();
      assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth'), 'Account overflow at ' + width);
      if (width === 390) await screenshot('account-mobile');
    }
    const adminAgain = await browserPost('/api/auth/sign-in/email', { email: ownerEmail, password: ownerPassword });
    assert.equal(adminAgain.status, 200);
    await go('/admin', "document.body.textContent.includes('Operations dashboard')");
    await click('orders');
    await waitFor("document.body.textContent.includes('Provider drip-feed settings')");
    assert.match(await evaluate(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directId)})).textContent`), /quantity \/ run/);
    await evaluate(`(() => {const article=[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directId)}));const input=article.querySelector('input:not([type=checkbox])');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Simulated drip-feed reference in isolated QA');input.dispatchEvent(new Event('input',{bubbles:true}));})()`); await settle();
    assert.equal(await evaluate(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directId)})).querySelector('button').disabled`), true, 'Admin confirms schedule before processing');
    await evaluate(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directId)})).querySelector('input[type=checkbox]').click()`); await settle();
    await screenshot('admin-delivery-plan');
    await evaluate(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directId)})).querySelector('button').click()`);
    await waitFor(`[...document.querySelectorAll('article')].find(a=>a.textContent.includes(${JSON.stringify(directId)}))?.textContent.includes('In progress')`);
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: real registration/login/logout, deposit review, admin approval, wallet debit, direct order, account history, saved checkout after login, admin authorization and responsive account layout, payment-gated gradual/default delivery selection, exact batch preview and unchanged wallet balance.');
  } finally { await call('Page.close'); socket.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
