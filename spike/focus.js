// focus.js — render the page at 90% over a blurred canvas snapshot, in-window.
// Injected at document_start. We force <body> to be the viewport-sized scroller
// before scaling it, so the 90% frame is fixed to the viewport and scroll stays
// inside it (no content spilling into the blur margin on root-scroller pages).
(function () {
  if (window.__mesaFocus) return;
  window.__mesaFocus = true;

  let bgEl = null;

  function mountBg(bgUrl) {
    if (bgEl) bgEl.remove();
    bgEl = document.createElement('div');
    bgEl.id = 'mesa-bg';
    const bg = bgUrl
      ? `background:url('${bgUrl}') center/cover no-repeat;`
      : `background:#1a1a1a;`;
    bgEl.style.cssText =
      `position:fixed;inset:0;z-index:-1;${bg}filter:blur(18px) brightness(.55);`;
    document.documentElement.appendChild(bgEl);
    bgEl.addEventListener('click', exitAll);
  }

  function applyFrame() {
    const html = document.documentElement, b = document.body;
    if (!b) return false;
    // normalize scrolling onto <body> so the scaled box is viewport-fixed
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    b.style.margin = '0';
    b.style.height = '100%';
    b.style.overflow = 'auto';
    b.style.transition = 'transform .25s ease';
    b.style.transformOrigin = 'center center';
    b.style.transform = 'scale(0.9)';
    return true;
  }

  function enter(bgUrl) {
    mountBg(bgUrl);                       // blurred map shows immediately
    if (!applyFrame()) {                  // body not parsed yet (document_start)
      const tryFrame = () => { if (!applyFrame()) requestAnimationFrame(tryFrame); };
      requestAnimationFrame(tryFrame);
    }
  }

  function exit() {
    if (bgEl) { bgEl.remove(); bgEl = null; }
    const html = document.documentElement, b = document.body;
    if (b) {
      b.style.transform = '';
      b.style.transformOrigin = '';
      b.style.transition = '';
      b.style.overflow = '';
      b.style.height = '';
      b.style.margin = '';
    }
    html.style.overflow = '';
    html.style.height = '';
  }

  function exitAll() {
    exit();
    try { browser.runtime.sendMessage({ type: 'exit' }); } catch (e) {}
  }

  browser.runtime.onMessage.addListener((m) => {
    if (m.type === 'enter') enter(m.bg);
    if (m.type === 'exit') exit();
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') exitAll();
  }, true);
})();
