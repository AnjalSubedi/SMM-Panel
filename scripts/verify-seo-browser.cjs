const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const base = 'http://localhost:3002';
  const target = await (await fetch('http://localhost:9223/json/new?' + 'about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0; const pending = new Map(); const errors = [];
  socket.addEventListener('message', event => { const message = JSON.parse(event.data); if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text); if (message.id && pending.has(message.id)) { const request = pending.get(message.id); pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); } });
  const call = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); socket.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate('Boolean(document.body) && (' + expression + ')')) return; await new Promise(resolve => setTimeout(resolve, 100)); } throw new Error('Not ready: ' + expression); };
  try {
    await call('Runtime.enable'); await call('Page.enable');
    for (const [slug, platform] of [['facebook','Facebook'],['instagram','Instagram'],['youtube','YouTube'],['tiktok','TikTok']]) {
      await call('Page.navigate', { url: base + '/services/' + slug });
      await waitFor('document.querySelector("#service-platform")?.value === ' + JSON.stringify(platform) + ' && Object.keys(document.querySelector("#service-platform")).some(key=>key.startsWith("__reactProps"))');
      await evaluate('(()=>{const el=document.querySelector("#service-category");el.value=el.options[1].value;el.dispatchEvent(new Event("change",{bubbles:true}));})()');
      await waitFor('document.querySelector("#service-boost")?.options.length > 1');
      await evaluate('(()=>{const el=document.querySelector("#service-boost");el.value=el.options[1].value;el.dispatchEvent(new Event("change",{bubbles:true}));})()');
      await waitFor('!!document.querySelector("#quantity")');
      assert.ok(await evaluate('document.querySelector("#quantity").valueAsNumber >= Number(document.querySelector("#quantity").min)'));
      await evaluate('[...document.querySelectorAll("button")].find(el=>el.textContent.includes("Review your order")).click()');
      await waitFor('!!document.querySelector("dialog[open]")');
      assert.ok(await evaluate('document.querySelector("dialog").textContent.includes(' + JSON.stringify(platform) + ')'));
      await evaluate('document.querySelector("dialog button").click()');
    }
    await evaluate('[...document.querySelectorAll("a")].find(el=>el.getAttribute("href")==="/services/instagram").click()');
    await waitFor('location.pathname === "/services/instagram" && document.querySelector("#service-platform")?.value === "Instagram"');
    for (const route of ['/services', '/services/facebook', '/website-design']) {
      await call('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true });
      await call('Page.navigate', { url: base + route });
      await waitFor('location.pathname === ' + JSON.stringify(route) + ' && !!document.querySelector("h1")');
      await evaluate('document.fonts.ready.then(()=>{window.scrollTo({top:0,behavior:"instant"});return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));})');
      assert.equal(await evaluate('Math.round(document.querySelector("header").getBoundingClientRect().top)'), 0, route + ' header is visible');
      assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth'), route + ' has no page overflow on mobile');
      await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }).then(result => fs.writeFileSync('.qa/seo' + route.replaceAll('/', '-') + '-mobile.png', Buffer.from(result.data, 'base64')));
    }
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log('SEO browser checks passed: all four platform calculators, checkout selection, responsive pages and no uncaught errors. No orders or payments submitted.');
  } finally { socket.close(); await fetch('http://localhost:9223/json/close/' + target.id); }
})().catch(error => { console.error(error); process.exitCode = 1; });
