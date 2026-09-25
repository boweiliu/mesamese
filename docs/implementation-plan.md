# Mesamese — Implementation Plan

## Stack
- **WXT** — Vite, TS, manifest-gen, HMR. Firefox **MV2** (more powerful; personal use).
- **tldraw** — infinite canvas, custom shapes, pan/zoom built in.
- **webextension-polyfill** — typed `browser.*`.

## Project structure (WXT)
```
mesamese/
  entrypoints/
    background.ts          // tab tracking, thumbnails, window mgmt, storage, messaging
    canvas/
      index.html          // the canvas page (fullscreen)
      main.tsx            // mount tldraw, custom shape, blur state, IPC
    content.ts            // (optional) hotkey passthrough / new-tab override
  components/
    TabCardShape.tsx      // tldraw custom shape: thumbnail + title + favicon
    useCanvasStore.ts     // cards/regions/links state (synced with bg)
  lib/
    storage.ts            // layout persistence
    thumb.ts              // captureTab wrapper + cache
    panes.ts              // pop/merge/move live panes (windows API)
    messaging.ts          // bg <-> canvas RPC
  types.ts
  wxt.config.ts
```

## Components / modules

### 1. `background.ts` (event page)
- **Tab model sync** — listen to `tabs.onCreated/onUpdated/onMoved/onRemoved/onActivated`; maintain the card list; broadcast diffs to the canvas page.
- **Thumbnail capture** — on tab activate + `webNavigation.onCompleted`, call `tabs.captureTab(id)`; cache data URLs; rate-limit (~2/s); send to canvas.
- **Pane management** — `popToPane(tabId, rect)`, `mergeBack(tabId)`, `closePane(tabId)` via `windows.create/update/remove` + `tabs.move`.
- **Storage** — load/save `Layout` to `storage.local` (debounced).
- **Commands** — hotkey → open/focus the canvas page (`tabs.create` or focus existing).
- **New-tab override** — set the canvas page as the new-tab URL (`chrome_url_overrides.newTab` / Firefox `new_tab`).

### 2. Canvas page (`entrypoints/canvas`)
- Mount the tldraw editor.
- Custom shape **`tab-card`**: thumbnail, title, favicon, close `X`; drag → move; double-click/Enter → message bg to **pop live**.
- **Blur state** — a `data-focused` class on the root; when a pane is live, apply `filter: blur(20px)` + dim to the tldraw container; on exit, remove.
- **IPC** — subscribe to bg messages (cards added/updated/removed, thumb updated, pane opened/closed); emit user actions (pop, close, new tab, arrange → persist).
- Pan/zoom — tldraw default; persist camera per session.

### 3. `TabCardShape.tsx` (tldraw custom shape)
- Props: `tabId, title, favicon, thumb, alive`.
- Render: rounded rect, thumbnail fill, title bar, favicon, close button.
- Behaviour: double-click → emit "pop"; drag → tldraw move; `X` → emit "close".

### 4. `lib/panes.ts`
- `pop(tabId)` — compute 90% rect from the focused window's bounds; `windows.create({tabId, type:'popup', left,top,width,height})`; store pane map; message canvas to blur.
- `exit(tabId)` — `tabs.move(tabId,{windowId: mainWin, index:-1})`; `windows.remove(paneWinId)`; message canvas to un-blur.
- `movePane(tabId, rect)` — `windows.update`.
- `windows.onBoundsChanged` → sync user-dragged popup (stretch).

### 5. `lib/thumb.ts`
- `capture(tabId)` — `browser.tabs.captureTab(tabId,{format:'jpeg',quality:0.7})`; LRU cache; rate-limit; return data URL.
- Re-capture on activation + navigation complete.

### 6. `lib/storage.ts`
- Load/save `Layout`; debounce writes; merge ghost cards (`alive:false`) on startup.

### 7. `lib/messaging.ts`
- Typed RPC between bg and canvas (`runtime.sendMessage` / `runtime.connect`).

### 8. `types.ts`
- `Card`, `Region`, `Link`, `Layout`, `Pane`, message types.

## Build order (milestones)
1. **Skeleton** — WXT + tldraw; canvas page opens as new-tab; hotkey summons it.
2. **Tab sync** — bg tracks tabs, sends card list to canvas; canvas renders static cards (no thumbs) in a grid.
3. **Thumbnails** — `captureTab` on activate/nav; cards show thumbs.
4. **Arrange** — drag cards, pan/zoom (tldraw free), persist layout to storage.
5. **Pop-to-live** — click card → `windows.create` popup at 90% → blur canvas → escape → merge back. **The core magic.**
6. **Polish** — close card closes tab, new tab from canvas, ghost cards on restart, opener links, regions/groups.
7. **Stretch** — multi-pane tile-live, sidebar mini-map, search, containers-as-panes, saved views.

## The vertical slice to build first
Milestone 5 is the whole product in miniature: one card → click → live popup over blurred canvas → escape → back. Build 1→5 as the first end-to-end slice; everything else is depth on top.

## Risks
- **`captureTab` rate limit (~2/s)** — throttle; only re-thumb the active tab + on demand.
- **Popup z-order/focus on macOS** — test; may need `windows.update({focused:true})`.
- **tldraw perf with many cards** — virtualize/cull off-screen (tldraw does some); cap thumbs in view.
- **Event-page idle** — MV2 event page is less aggressive than MV3 SW, but still: persist to storage on every change, rehydrate from storage on wake.
