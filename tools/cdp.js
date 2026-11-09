/* Küçük bir Chrome DevTools Protocol sürücüsü: bağımlılık yok (Node'un yerleşik WebSocket'i).
   Chrome penceresiz (headless), sessiz ve düşük öncelikle çalışır; ekrana hiçbir şey açmaz. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEYS = {
  ArrowUp: ['ArrowUp', 38], ArrowRight: ['ArrowRight', 39], ArrowDown: ['ArrowDown', 40], ArrowLeft: ['ArrowLeft', 37],
  Space: [' ', 32], Enter: ['Enter', 13], Escape: ['Escape', 27], Tab: ['Tab', 9], Backspace: ['Backspace', 8], Delete: ['Delete', 46],
};
for (const ch of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') KEYS['Key' + ch] = [ch.toLowerCase(), ch.charCodeAt(0)];
for (const d of '0123456789') KEYS['Digit' + d] = [d, d.charCodeAt(0)];

async function launch(opts) {
  const chromePath = opts.chromePath || process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  try { os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (e) { /* önemli değil */ }
  // her çalıştırma kendi geçici profilini kullanır: yarıda kesilen bir önceki çalıştırma kilit bırakamaz
  const userDataDir = opts.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'yanki-chrome-'));
  fs.mkdirSync(userDataDir, { recursive: true });
  const args = [
    '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + userDataDir,
    '--mute-audio', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--disable-component-update', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required', '--window-size=' + (opts.width || 1280) + ',' + (opts.height || 800), 'about:blank',
  ];
  const proc = spawn(chromePath, args, { stdio: 'ignore', windowsHide: true });
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  let wsUrl = null;
  for (let i = 0; i < 150 && !wsUrl; i++) {
    await sleep(100);
    if (fs.existsSync(portFile)) {
      const lines = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
      if (lines.length >= 2 && lines[0] && lines[1]) wsUrl = 'ws://127.0.0.1:' + lines[0] + lines[1];
    }
  }
  if (!wsUrl) { proc.kill(); throw new Error('Chrome başlamadı'); }
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', () => rej(new Error('WebSocket açılamadı')), { once: true }); });
  let seq = 0;
  const pending = new Map(), listeners = new Set();
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(m.error.message + (m.error.data ? ' — ' + m.error.data : ''))); else p.res(m.result);
    } else if (m.method) for (const l of listeners) l(m);
  });
  const send = (method, params, sessionId) => new Promise((res, rej) => {
    const id = ++seq; pending.set(id, { res, rej });
    ws.send(JSON.stringify(sessionId ? { id, method, params: params || {}, sessionId } : { id, method, params: params || {} }));
  });

  async function newPage(url, vp) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const S = (m, p) => send(m, p, sessionId);
    const logs = [], errors = [];
    listeners.add(m => {
      if (m.sessionId !== sessionId) return;
      if (m.method === 'Runtime.consoleAPICalled') {
        const txt = m.params.args.map(a => (a.value !== undefined ? String(a.value) : a.description || a.type)).join(' ');
        logs.push('[' + m.params.type + '] ' + txt);
        if (m.params.type === 'error') errors.push(txt);
      } else if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        errors.push((d.exception && d.exception.description) || d.text);
      }
    });
    await S('Page.enable'); await S('Runtime.enable');
    const v = vp || { width: 1280, height: 800, dpr: 1 };
    await S('Emulation.setDeviceMetricsOverride', { width: v.width, height: v.height, deviceScaleFactor: v.dpr || 1, mobile: false });
    const loaded = new Promise(res => { const l = m => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') { listeners.delete(l); res(); } }; listeners.add(l); });
    await S('Page.navigate', { url });
    await loaded;
    const page = {
      logs, errors, send: S,
      async eval(expr) {
        const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
        if (r.exceptionDetails) throw new Error('eval: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
        return r.result.value;
      },
      async key(code, mods) {
        const k = KEYS[code];
        if (!k) throw new Error('bilinmeyen tuş: ' + code);
        const base = { key: k[0], code, windowsVirtualKeyCode: k[1], nativeVirtualKeyCode: k[1], modifiers: mods || 0 };
        await S('Input.dispatchKeyEvent', Object.assign({ type: 'rawKeyDown' }, base));
        await S('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base));
      },
      async click(x, y) {
        await S('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
        await S('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await S('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
      },
      async setViewport(width, height, dpr) { await S('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr || 1, mobile: false }); },
      async shot(file) {
        const r = await S('Page.captureScreenshot', { format: 'png' });
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
        return file;
      },
      async waitFor(expr, timeout) {
        const t0 = Date.now();
        while (Date.now() - t0 < (timeout || 8000)) { if (await page.eval(expr)) return true; await sleep(40); }
        throw new Error('zaman aşımı: ' + expr);
      },
    };
    return page;
  }
  return {
    newPage,
    async close() {
      try { await Promise.race([send('Browser.close'), sleep(1500)]); } catch (e) { /* kapanıyor */ }
      try { ws.close(); } catch (e) { /* yok say */ }
      await sleep(300);
      try { proc.kill(); } catch (e) { /* zaten kapandı */ }
      if (!opts.userDataDir) {   // kendi açtığımız geçici profili sil (Chrome dosyaları bırakana kadar birkaç kez dene)
        for (let i = 0; i < 6; i++) {
          try { fs.rmSync(userDataDir, { recursive: true, force: true }); break; } catch (e) { await sleep(400); }
        }
      }
    },
  };
}

module.exports = { launch, sleep };
