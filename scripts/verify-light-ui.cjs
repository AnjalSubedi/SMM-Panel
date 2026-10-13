const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

// Local browser QA; start Chrome with --remote-debugging-port=9223 first.
// Keep its disposable user-data-dir in the system temp folder, outside this project.
async function main() {
  const target = await (await fetch('http://localhost:9223/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  let seq = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const task = pending.get(message.id);
      if (task) { pending.delete(message.id); clearTimeout(task.timer); message.error ? task.reject(message.error) : task.resolve(message.result); }
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  const settle = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const clickText = async (text) => { assert.equal(await evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`), true, text); await settle(); };
  const setInput = async (selector, value) => {
    await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await settle();
  };

  const setSelect = async (selector, value) => {
    await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await settle();
  };
  const result = [];
  async function screenshot(name, fullPage = false) {
    const metrics = await call('Page.getLayoutMetrics');
    const options = fullPage ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 }, captureBeyondViewport: true } : {};
    const image = await call('Page.captureScreenshot', { format: 'png', ...options });
    await fs.writeFile(path.join(process.cwd(), '.qa', name + '.png'), Buffer.from(image.data, 'base64'));
  }
  try {
    await call('Page.enable'); await call('Runtime.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
    await fs.mkdir(path.join(process.cwd(), '.qa'), { recursive: true });
    await call('Page.navigate', { url: process.env.QA_URL || 'http://localhost:3000' });
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      ready = await evaluate(`!!document.querySelector('#service-platform') && document.querySelectorAll('#packages article').length === 4 && !document.querySelector('header .animate-pulse')`);
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.equal(ready, true, 'Hydrated page and catalog available');
    await evaluate('document.fonts.ready');
    assert.equal(await evaluate(`document.querySelectorAll('select').length`), 3);
    assert.equal(await evaluate(`document.querySelector('header').querySelectorAll('img').length`), 0);
    assert.equal(await evaluate(`getComputedStyle(document.documentElement).colorScheme`), 'light');
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'Desktop overflow');
    const positions = await evaluate(`[...document.querySelectorAll('#packages article button')].map(b => b.getBoundingClientRect().bottom)`);
    assert.ok(Math.max(...positions) - Math.min(...positions) <= 2, 'Aligned bundle actions');
    result.push('Light theme, SVG brand, equal-height bundles, three dropdowns, no desktop overflow');
    await screenshot('desktop', true);


    assert.equal(await evaluate(`document.querySelector('#service-category').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('#service-boost').disabled`), true);
    assert.equal(await evaluate(`document.querySelector('aside button[aria-haspopup]') === null`), true);
    const seen = new Set();
    const platforms = await evaluate(`[...document.querySelector('#service-platform').options].map(o => o.value).filter(Boolean)`);
    assert.equal(platforms.length, 9);
    for (const platform of platforms) {
      await setSelect('#service-platform', platform);
      assert.equal(await evaluate(`document.querySelector('#service-category').value`), '');
      assert.equal(await evaluate(`document.querySelector('#service-boost').disabled`), true);
      assert.equal(await evaluate(`document.querySelector('#quantity') === null`), true);
      const categories = await evaluate(`[...document.querySelector('#service-category').options].map(o => o.value).filter(Boolean)`);
      assert.ok(categories.length > 0);
      assert.ok(!categories.includes('Other services'), 'Every configured service has a meaningful category');
      for (const category of categories) {
        await setSelect('#service-category', category);
        assert.equal(await evaluate(`document.querySelector('#service-boost').value`), '');
        const options = await evaluate(`[...document.querySelector('#service-boost').options].map(o => ({id:o.value, label:o.text})).filter(o => o.id)`);
        assert.ok(options.length > 0);
        for (const option of options) {
          assert.ok(option.label.includes('NPR '), 'Option includes a rate');
          assert.ok(!seen.has(option.id), 'Each service belongs to one category');
          seen.add(option.id);
        }
      }
    }
    assert.equal(seen.size, 58, 'All 58 services reachable through categories');
    await setSelect('#service-platform', 'Facebook');
    await setSelect('#service-category', 'Followers & subscribers');
    await setSelect('#service-boost', 'FB_01');
    result.push('Three cascading dropdowns; reset/gating behavior; all 58 services reachable across nine platforms');

    assert.equal(await evaluate(`document.querySelector('#quantity').value`), '100');
    assert.match(await evaluate(`document.querySelector('aside [aria-live]').textContent`), /14.9/);
    await clickText('+10');
    assert.equal(await evaluate(`document.querySelector('#quantity').value`), '110');
    assert.match(await evaluate(`document.querySelector('aside [aria-live]').textContent`), /16.39/);
    await setInput('#quantity', '1250');
    assert.match(await evaluate(`document.querySelector('aside [aria-live]').textContent`), /186.25/);
    await setInput('#quantity', '10');
    assert.equal(await evaluate(`document.querySelector('aside button[aria-haspopup]').disabled`), true);
    await setInput('#quantity', '1250');
    const focusSelector = 'aside button[aria-haspopup]';
    await evaluate(`document.querySelector('${focusSelector}').focus(); document.querySelector('${focusSelector}').click()`); await settle();
    assert.equal(await evaluate(`document.querySelector('dialog').open`), true);
    assert.match(await evaluate(`document.querySelector('dialog').textContent`), /186.25/);
    await evaluate(`new Promise(resolve => { const img=document.querySelector('dialog img'); if(img.complete) resolve(); else img.addEventListener('load', resolve, {once:true}); })`);
    assert.ok(await evaluate(`document.querySelector('dialog img').naturalWidth > 0`), 'Supplied QR loads');
    assert.ok(await evaluate(`document.querySelector('a[href*="wa.me/9779744505435"]') !== null`), 'WhatsApp number configured');
    await screenshot('checkout');
    await clickText('Use account wallet');
    assert.equal(await evaluate(`document.querySelector('#payment-panel-wallet').hidden`), false);
    assert.equal(await evaluate(`document.querySelector('dialog form button:not([type])').disabled`), true);
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await settle();
    assert.equal(await evaluate(`document.querySelector('dialog') === null`), true);
    assert.equal(await evaluate(`document.activeElement === document.querySelector('${focusSelector}')`), true);
    result.push('Presets, fractional NPR total, invalid quantity blocking, checkout total, wallet unavailable, Escape/focus restoration');


    await setSelect('#service-category', 'Likes & reactions');
    await setSelect('#service-boost', 'FB_05');
    assert.equal(await evaluate(`document.querySelector('#quantity').min`), '10');
    assert.equal(await evaluate(`document.querySelector('#quantity').value`), '10');
    assert.match(await evaluate(`document.querySelector('aside [aria-live]').textContent`), /0.89/);
    await evaluate(`document.querySelector('[aria-label="Increase quantity"]').click()`); await settle();
    assert.equal(await evaluate(`document.querySelector('#quantity').value`), '11');
    await setInput('#quantity', '17');
    assert.match(await evaluate(`document.querySelector('aside [aria-live]').textContent`), /1.51/);
    await setInput('#quantity', '9');
    assert.equal(await evaluate(`document.querySelector('aside button[aria-haspopup]').disabled`), true);
    await setInput('#quantity', '10');
    await evaluate(`document.querySelector('aside button[aria-haspopup]').click()`); await settle();
    assert.match(await evaluate(`document.querySelector('dialog').textContent`), /0.89/);
    await call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await settle();
    result.push('Provider minimum 10, individual-unit adjustment, arbitrary quantity, below-minimum blocking and proportional checkout total');

    await setSelect('#service-platform', 'Instagram');
    assert.equal(await evaluate(`document.querySelector('#service-category').value`), '');
    assert.equal(await evaluate(`document.querySelector('#quantity') === null`), true);
    await setSelect('#service-category', 'Likes for future posts');
    await setSelect('#service-boost', 'IG_05');
    assert.equal(await evaluate(`document.querySelector('#quantity').readOnly`), true);
    assert.equal(await evaluate(`document.querySelector('#quantity').value`), '1');
    assert.match(await evaluate(`document.querySelector('aside [aria-live]').textContent`), /1,199/);
    await setSelect('#service-platform', 'YouTube');
    await setSelect('#service-category', 'Watch time');
    await setSelect('#service-boost', 'YT_06');
    assert.match(await evaluate(`document.querySelector('aside [aria-live]').textContent`), /3,499/);
    await setSelect('#service-category', 'Followers & subscribers');
    assert.equal(await evaluate(`document.querySelector('#service-boost').value`), '');
    assert.equal(await evaluate(`document.querySelector('#quantity') === null`), true);
    await setSelect('#service-platform', 'Facebook');
    await setSelect('#service-category', 'Followers & subscribers');
    await setSelect('#service-boost', 'FB_01');
    result.push('Category and platform changes clear the service and calculator; fixed subscription and watch-hour pricing');
    await evaluate(`document.getElementById('calculator').scrollIntoView({behavior:'instant'})`); await settle();
    await screenshot('calculator');
    assert.equal(await evaluate(`Math.round(document.querySelector('header').getBoundingClientRect().top)`), 0);
    for (const width of [390, 320, 768]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true });
      await evaluate(`scrollTo({top:0, behavior:'instant'})`); await settle();
      const overflow = await evaluate(`({width:innerWidth, content:document.documentElement.scrollWidth})`);
      assert.ok(overflow.content <= width, `${width}px overflow: ${JSON.stringify(overflow)}`);
      if (width === 390) await screenshot('mobile', true);
    }
    result.push('Sticky header and overflow-free layouts at 320, 390, 768 and 1440px');
    assert.deepEqual(errors, [], 'Browser errors');
    console.log(JSON.stringify({ passed: result, screenshots: '.qa/', runtimeErrors: errors }, null, 2));
  } finally { socket.close(); await fetch('http://localhost:9223/json/close/' + target.id); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
