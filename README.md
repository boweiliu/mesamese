# Mesamese

**Your tabs, in space.** A Firefox extension that turns your tabs into an infinite, zoomable canvas of snapshot cards. Click a card and that tab opens live at ~90% over a blurred map of everything else — so you never lose context.

> Work in progress. This repo currently holds a **raw spike** (no build, no npm) plus the design docs.

## Why
Tabs live in a 1D strip. After twenty of them you can't read titles, can't find the one you wanted, can't see the shape of what you're doing. You have spatial memory; the tab strip doesn't use it. Mesamese gives the sprawl a place — a 2D canvas you pan and zoom, like Figma, where each tab is a card.

## The core idea
- **Map mode** — the canvas (a Firefox new-tab page) shows your tabs as draggable cards with thumbnails.
- **Focus mode** — click a card and that tab becomes the active tab in your current window, rendered at 90% over a **blurred snapshot of the canvas** behind it. Browser toolbars stay intact. The page is fully live and interactive.
- **Esc** (or click the blurred margin) → back to the map.

The focus trick is a **content script** (`focus.js`) injected at `document_start`: it scales `document.body` to `0.9` and paints a blurred canvas snapshot as a `position:fixed` background. No second window, no tab moved or duplicated — the tab literally becomes your active tab. See [docs/design.md](docs/design.md) for the full model and the constraints that led here (and [docs/implementation-plan.md](docs/implementation-plan.md) for the path to the real tldraw-based build).

## Run the spike
No build step. Raw Firefox MV2 extension.

1. Firefox → `about:debugging#/runtime/this-firefox`
2. "Load Temporary Add-on…" → pick `spike/manifest.json`
3. open a **new tab** (overridden to the canvas) or click the **Mesamese** toolbar button
4. click a card → that tab opens at 90% over the blurred map; **Esc** to return

### Optional: live log server
The spike can POST logs to a tiny local server so you can inspect capture behavior:
```
python3 logserver.py   # listens on 127.0.0.1:8787 -> live.log
```
Then on the canvas, **Capture all** re-screenshots every tab; **Download logs** dumps a JSON snapshot to `~/Downloads/mesamese-log.json`.

## Features (spike)
- Cards from live tabs, with `tabs.captureTab` thumbnails (any tab, incl. background — Firefox-only).
- Drag cards; layout + thumbnails **persist** in `storage.local`, keyed by URL (survives restart; revisits restore position).
- In-window 90%/blur focus mode (content script, `document_start`, body forced to be the scroller so the frame is viewport-fixed).
- Manual **Capture all** + live logs to a local server.

## What's not done yet
Real infinite pan/zoom (tldraw), regions/groups, opener links, ghost cards + session restore, multi-pane "tile live", sidebar mini-map, search, containers-as-panes, saved views. See [docs/TODO.md](docs/TODO.md).

## Docs
- [docs/design.md](docs/design.md) — the model, flows, data model, APIs
- [docs/landing-page.md](docs/landing-page.md) — the pitch
- [docs/implementation-plan.md](docs/implementation-plan.md) — WXT + tldraw build plan
- [docs/TODO.md](docs/TODO.md) — backlog

## Status
Personal experiment. Firefox only (relies on `tabs.captureTab` of background tabs). MV2.

*Mesamese* — a nonsense name inspired by *mesa* (a flat-topped landform; tabs as flat panes on a plain).

## License
MIT — see [LICENSE](LICENSE).
