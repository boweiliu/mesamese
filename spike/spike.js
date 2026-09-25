// Mesa spike v7 — map with persisted thumbs/layout (URL-keyed) + manual capture +
// logs auto-flushed to a local server (http://127.0.0.1:8787) so the assistant can read them.
const board = document.getElementById('board');
const statusEl = document.getElementById('status');
const me = await browser.tabs.getCurrent();
const originWin = me.windowId;

const COLS = 5, W = 240, H = 150, GX = 18, GY = 18, OX = 40, OY = 40;
const cards = new Map();

// ---- logging: console + in-memory + auto-flush to local server ----
const SERVER = 'http://127.0.0.1:8787/log';
const LOG = [];
const RUN = Math.random().toString(36).slice(2, 10);
let LOG_SEQ = 0, lastSent = 0, serverUp = true, flushTimer = null;

function log(level, msg, extra) {
  const e = { t: new Date().toISOString(), id: RUN + '-' + LOG_SEQ, seq: LOG_SEQ++, level, msg, ...(extra || {}), source: 'canvas' };
  LOG.push(e);
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)('[mesa]', msg, extra || {});
  scheduleFlush();
  return e;
}
function scheduleFlush() { if (flushTimer) return; flushTimer = setTimeout(flush, 400); }
async function flush() {
  flushTimer = null;
  if (lastSent >= LOG.length) return;
  const entries = LOG.slice(lastSent);
  try {
    const r = await fetch(SERVER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }) });
    if (r.ok) { lastSent = LOG.length; serverUp = true; }
  } catch (e) {
    if (serverUp) { console.warn('[mesa] log server down — run logserver.py', e.message); serverUp = false; }
  }
}
function setStatus(s) { statusEl.textContent = s; }

// ---- persisted state (storage.local), keyed by URL ----
let thumbs = {}, layout = {};
async function loadState() {
  const all = await browser.storage.local.get(null);
  thumbs = {};
  for (const k in all) if (k.startsWith('mesa:t:')) thumbs[k.slice(7)] = all[k];
  layout = all['mesa:layout'] || {};
  log('info', 'state loaded', { thumbs: Object.keys(thumbs).length, layoutEntries: Object.keys(layout).length });
}
async function putThumb(url, dataUrl) { thumbs[url] = dataUrl; await browser.storage.local.set({ ['mesa:t:' + url]: dataUrl }); }
async function putLayout() { await browser.storage.local.set({ 'mesa:layout': layout }); }

await loadState();

function cardPos(t, i) {
  const p = layout[t.url];
  if (p) return { x: p.x, y: p.y };
  return { x: OX + (i % COLS) * (W + GX), y: OY + Math.floor(i / COLS) * (H + GY) };
}
function makeCard(t, i) {
  if (t.id === me.id || cards.has(t.id)) return;
  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.tabId = t.id;
  el.dataset.url = t.url;
  const { x, y } = cardPos(t, i);
  el.style.left = x + 'px'; el.style.top = y + 'px';
  const cached = thumbs[t.url];
  el.innerHTML =
    `<div class="thumb"${cached ? ` style="background-image:url('${cached}')"` : ''}></div>
     <div class="bar"><img src="${t.favIconUrl || ''}" onerror="this.style.display='none'">
       <span>${escapeHtml(t.title || t.url || '(untitled)')}</span></div>`;
  makeDraggable(el);
  el.addEventListener('click', () => browser.runtime.sendMessage({ type: 'focus', tabId: t.id }));
  board.appendChild(el);
  cards.set(t.id, el);
}
function layoutAll(tabs) { tabs.forEach((t, i) => makeCard(t, i)); }

const tabs = await browser.tabs.query({ windowId: originWin });
log('info', 'tabs', { count: tabs.length, ids: tabs.map(t => ({ id: t.id, url: t.url })) });
layoutAll(tabs);

// ---- capture ----
const inflight = new Set();
async function captureInto(t) {
  if (inflight.has(t.id)) { log('warn', 'capture skipped (inflight)', { id: t.id, url: t.url }); return; }
  inflight.add(t.id);
  const start = performance.now();
  try {
    const url = await browser.tabs.captureTab(t.id, { format: 'jpeg', quality: 60 });
    const el = cards.get(t.id);
    if (el) el.querySelector('.thumb').style.backgroundImage = `url('${url}')`;
    if (t.url) await putThumb(t.url, url);
    log('info', 'capture ok', { id: t.id, url: t.url, bytes: url.length, ms: Math.round(performance.now() - start) });
  } catch (e) {
    log('warn', 'captureTab failed', { id: t.id, url: t.url, error: e && e.message, ms: Math.round(performance.now() - start) });
  } finally { inflight.delete(t.id); }
}
async function captureAll() {
  const all = (await browser.tabs.query({ windowId: originWin })).filter(t => t.id !== me.id);
  log('info', 'captureAll start', { count: all.length });
  setStatus(`capturing ${all.length} tabs…`);
  let ok = 0, fail = 0;
  for (const t of all) {
    const before = LOG.length;
    await captureInto(t);
    if (LOG.length > before && LOG[LOG.length - 1].msg === 'capture ok') ok++; else fail++;
    await new Promise(r => setTimeout(r, 600));
  }
  log('info', 'captureAll done', { ok, fail });
  setStatus(`captured ${ok} ok / ${fail} fail`);
  flush();
}

(async () => { for (const t of tabs) { if (t.id !== me.id) { await captureInto(t); await new Promise(r => setTimeout(r, 600)); } } })();

browser.tabs.onCreated.addListener(async (t) => { if (t.windowId === originWin) layoutAll(await browser.tabs.query({ windowId: originWin })); });
browser.tabs.onUpdated.addListener((tabId, change, t) => {
  if (t.windowId !== originWin) return;
  const el = cards.get(tabId); if (!el) return;
  if (change.url) {
    el.dataset.url = t.url;
    const p = layout[t.url];
    if (p) { el.style.left = p.x + 'px'; el.style.top = p.y + 'px'; }
    const cached = thumbs[t.url];
    el.querySelector('.thumb').style.backgroundImage = cached ? `url('${cached}')` : '';
  }
  if (change.title || change.favIconUrl) {
    el.querySelector('.bar').innerHTML =
      `<img src="${t.favIconUrl || ''}" onerror="this.style.display='none'">
       <span>${escapeHtml(t.title || t.url || '(untitled)')}</span>`;
  }
  if (change.status === 'complete' || change.url) captureInto(t);
});
browser.tabs.onRemoved.addListener((tabId) => { const el = cards.get(tabId); if (el) { el.remove(); cards.delete(tabId); } });

// ---- buttons ----
document.getElementById('cap').addEventListener('click', captureAll);
document.getElementById('dl').addEventListener('click', () => {
  const payload = { generatedAt: new Date().toISOString(), originWin, state: { thumbs: Object.keys(thumbs).length, layoutEntries: Object.keys(layout).length }, log: LOG };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  a.download = 'mesa-log.json'; a.click();
  log('info', 'logs downloaded', { entries: LOG.length });
  setStatus('logs downloaded to ~/Downloads/mesa-log.json');
});

// ---- drag ----
function makeDraggable(el) {
  let sx, sy, ox, oy, drag = false, moved = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = true; moved = false; sx = e.clientX; sy = e.clientY;
    ox = parseFloat(el.style.left); oy = parseFloat(el.style.top);
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 4) moved = true;
    el.style.left = (ox + e.clientX - sx) + 'px'; el.style.top = (oy + e.clientY - sy) + 'px';
  });
  const finish = () => {
    drag = false;
    if (moved && el.dataset.url) { layout[el.dataset.url] = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) }; putLayout(); }
  };
  el.addEventListener('pointerup', finish);
  el.addEventListener('pointercancel', finish);
  el.addEventListener('click', (e) => { if (moved) e.stopPropagation(); }, true);
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
