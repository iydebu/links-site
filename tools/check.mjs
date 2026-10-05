// Checks the links page in headless Chrome and writes screenshots (+ og.png from tools/og.html).
// Run: node tools/check.mjs [outdir]          (default: the local index.html)
//      LINKS_URL=https://links.iydebu.com/ node tools/check.mjs   (live)
//      node tools/check.mjs --og                (re-make og.png in the site root)
// Prints CHECK PASS / CHECK FAIL and exits 0/1.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OG = process.argv.includes('--og');
const OUT = path.resolve(process.argv.slice(2).find(a => !a.startsWith('--')) || path.join(ROOT, '.hermes', 'shots'));
// no LINKS_URL: serve the folder on 127.0.0.1:8296 (file:// breaks the font preload, so test over http like the live site)
const TYPES = { '.html': 'text/html', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2' };
let server;
if (!process.env.LINKS_URL) {
  server = http.createServer((q, r) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }).listen(8296, '127.0.0.1');
}
const URL_ = process.env.LINKS_URL || 'http://127.0.0.1:8296/';
const PORT = 9334;
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const prof = path.join(process.env.TMPDIR || process.env.TEMP, 'links-check-prof');
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${prof}`,
  '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--no-first-run', 'about:blank'], { stdio: 'ignore' });

let ws, id = 0; const wait = new Map(), errors = [], failed = [], reqUrl = new Map();
async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); const p = l.find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('chrome did not start');
}
const send = (method, params = {}) => new Promise((res, rej) => {
  const i = ++id; wait.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params }));
});
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  return r.result.value;
}
async function shot(file, full) {
  const p = { format: 'png' };
  if (full) { const h = await ev('document.documentElement.scrollHeight'); const w = await ev('innerWidth'); p.clip = { x: 0, y: 0, width: w, height: h, scale: 1 }; p.captureBeyondViewport = true; }
  const r = await send('Page.captureScreenshot', p);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
}
async function load(url, w, h, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  await send('Page.navigate', { url });
  for (let i = 0; i < 60 && (await ev('document.readyState')) !== 'complete'; i++) await sleep(150);
  await ev('document.fonts.ready.then(() => 1)');
  await sleep(800);
}

let ok = true;
try {
  ws = new WebSocket(await connect());
  await new Promise(r => ws.addEventListener('open', r));
  ws.addEventListener('message', m => {
    const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { const w = wait.get(d.id); wait.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push(d.params.args.map(a => a.value).join(' '));
    if (d.method === 'Network.requestWillBeSent') reqUrl.set(d.params.requestId, d.params.request.url);
    // a video element cancels its own range requests while it streams: that is not a broken file
    if (d.method === 'Network.loadingFailed' && !(d.params.canceled || /\.mp4$/.test(reqUrl.get(d.params.requestId) || '')))
      failed.push(d.params.errorText + ' ' + (reqUrl.get(d.params.requestId) || d.params.requestId));
    if (d.method === 'Network.responseReceived' && d.params.response.status >= 400) failed.push(d.params.response.status + ' ' + d.params.response.url);
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');

  if (OG) {
    await load(pathToFileURL(path.join(ROOT, 'tools', 'og.html')).href, 1200, 630, false);
    await sleep(1500);
    await shot(path.join(ROOT, 'og.png'));
    console.log('og.png written');
  } else {
    const presets = [['phone', 390, 844, true], ['small', 360, 740, true], ['pc', 1366, 768, false]];
    for (const [name, w, h, mob] of presets) {
      await load(URL_, w, h, mob);
      await sleep(1500);
      const info = await ev(`(() => { const v = document.getElementById('reel');
        return { overflowX: document.documentElement.scrollWidth > innerWidth, height: document.documentElement.scrollHeight,
          videoTime: +v.currentTime.toFixed(2), videoReady: v.readyState, paused: v.paused, muted: v.muted,
          playTop: Math.round(document.querySelector('.play').getBoundingClientRect().bottom),
          links: [...document.querySelectorAll('a[href]')].map(a => a.href),
          lilita: document.fonts.check('20px "Lilita One"') }; })()`);
      console.log(name, JSON.stringify({ ...info, links: info.links.length }));
      if (info.overflowX) { ok = false; console.log('  FAIL sideways scroll'); }
      if (info.paused || info.videoTime <= 0) { ok = false; console.log('  FAIL video not playing'); }
      if (mob && info.playTop > h) { ok = false; console.log('  FAIL Play button below the first screen'); }
      await shot(path.join(OUT, `${name}.png`));
      await shot(path.join(OUT, `${name}-full.png`), true);
      if (name === 'phone') {
        globalThis.links = info.links;
        // robot tap: bubble shows
        await ev(`document.getElementById('bot').click()`); await sleep(200);
        const said = await ev(`getComputedStyle(document.getElementById('bubble')).opacity`);
        console.log('  robot bubble opacity after tap', said);
        if (+said < 0.5) { ok = false; console.log('  FAIL robot tap'); }
        await shot(path.join(OUT, 'phone-robot.png'));
      }
    }
    // every outbound http link must answer (200 after redirects)
    for (const u of new Set(globalThis.links.filter(u => u.startsWith('http')))) {
      let st = 'ERR';
      try { const r = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile' } }); st = r.status; } catch (e) { st = e.cause?.code || e.message; }
      const good = st === 200 || (/linkedin\.com/.test(u) && (st === 999 || st === 429)) /* LinkedIn blocks bots */;
      console.log(`  link ${st} ${u}`);
      if (!good) { ok = false; console.log('  FAIL link'); }
    }
  }
  if (errors.length) { ok = false; console.log('page errors:', errors); } else console.log('no page errors');
  const realFails = failed.filter(f => !/favicon\.ico/.test(f));
  if (realFails.length) { ok = false; console.log('failed loads:', realFails); }
} catch (e) { ok = false; console.log('ERROR', e.message); }
finally { try { await send('Browser.close'); } catch {} chrome.kill(); server?.close(); }
console.log(ok ? 'CHECK PASS' : 'CHECK FAIL', '-> shots in', OUT);
process.exit(ok ? 0 : 1);
