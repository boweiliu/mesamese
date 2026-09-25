// Background: opens the canvas, and on "focus" it snapshots the canvas, switches
// to the target tab, and injects focus mode. Logs POST to the local log server too.
const SERVER = 'http://127.0.0.1:8787/log';
let canvasTabId = null, SEQ = 0;
const RUN = Math.random().toString(36).slice(2, 10);

function log(level, msg, extra) {
  const e = { t: new Date().toISOString(), id: RUN + '-' + SEQ, seq: SEQ++, level, msg, ...(extra || {}), source: 'bg' };
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)('[mesamese:bg]', msg, extra || {});
  fetch(SERVER, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries: [e] }) }).catch(() => {});
}

browser.browserAction.onClicked.addListener(async () => {
  const t = await browser.tabs.create({ url: browser.runtime.getURL("canvas.html") });
  canvasTabId = t.id;
  log('info', 'canvas opened', { tabId: t.id });
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'focus') return focusTab(msg.tabId, sender.tab && sender.tab.id);
  if (msg.type === 'exit') { if (canvasTabId != null) browser.tabs.update(canvasTabId, { active: true }).catch(() => {}); }
});

async function focusTab(tabId, sourceTabId) {
  const cId = sourceTabId != null ? sourceTabId : canvasTabId;
  canvasTabId = cId;
  let shot = null;
  try { shot = await browser.tabs.captureTab(cId, { format: 'jpeg', quality: 60 }); log('info', 'canvas snapshot ok', { bytes: shot.length }); }
  catch (e) { log('warn', 'canvas snapshot failed', { error: e && e.message }); }
  try { await browser.tabs.update(tabId, { active: true }); }
  catch (e) { log('error', 'activate failed', { tabId, error: e && e.message }); return; }
  try {
    await browser.tabs.executeScript(tabId, { file: 'focus.js', runAt: 'document_start' });
    await browser.tabs.sendMessage(tabId, { type: 'enter', bg: shot });
    log('info', 'focus mode injected', { tabId });
  } catch (e) { log('warn', 'inject failed (privileged page?)', { tabId, error: e && e.message }); }
}
