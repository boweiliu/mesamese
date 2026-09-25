# Mesamese — Design Doc (working name)

## One line
A Firefox extension that turns your tabs into an infinite, zoomable canvas of snapshot cards. Click a card and it pops live at ~90% over the blurred canvas; exit and you're back on the map.

## Why
Tabs live in a 1D strip across the top. After twenty of them you can't read titles, can't find the one you wanted, can't see the shape of what you're doing. You open a window for "research," another for "the project," another for "that thing later" — and still lose things. You have spatial memory. The tab strip doesn't use it.

Mesamese gives the sprawl a place: a 2D canvas you pan and zoom, like Figma or a whiteboard. You arrange tabs the way you think about them. Zoom out = the shape of your session. Zoom in = the work. The blurred-focus mode keeps the map present while you're in one tab, so context never disappears.

## The model
Three things:
- **Canvas** — an infinite pan/zoom surface (tldraw). Persistent. Lives in a dedicated extension page (fullscreen), summoned by hotkey / toolbar / new-tab.
- **Card** — a node on the canvas representing a tab. Static snapshot: thumbnail (`captureTab`), title, favicon, url, position, size, group, links. The *map representation* of a tab.
- **Pane** — when a card is "popped," the real tab becomes a `type:'popup'` window at ~90% of the viewport, centered, on top. The canvas blurs behind it. The *live* tab.

Two modes:
- **Map mode** — canvas in focus. Cards are snapshots. Pan, zoom, drag, group, link, search. No tab is live.
- **Focus mode** — one card (or N, stretch) is live as a popup. Canvas blurred behind. You interact with the real tab. The map stays visible (defocused) in the margin.

## State transitions
- Map → Focus: click / Enter / double-click a card → pop popup, blur canvas.
- Focus → Map: Escape / click blurred margin / hotkey → close popup (tab merges back to the main window as a background tab), un-blur canvas.
- Idle: tabs open/close/navigate in the main window normally; the extension keeps cards in sync (add / update / remove / re-thumbnail).

## Flows
1. **Install** → canvas opens as the new-tab page. Existing tabs laid out as cards (grid by recency, or by window).
2. **Browse normally** — new tabs appear as cards at an "inbox" drop zone (e.g. top-left); the native strip still works.
3. **Summon the map** — `Ctrl+Space` or toolbar → fullscreen canvas.
4. **Arrange** — drag cards, lasso, group into labeled regions, auto-link by opener (B opened from A → arrow).
5. **Go live** — click a card → 90% popup, blurred canvas, interact.
6. **Exit live** — Escape → back to map.
7. **New tab from canvas** — double-click empty space → new card → type URL/search → opens tab, optionally goes live.
8. **Close** — card's `X` closes the real tab; card becomes a ghost (faded) or is removed.
9. **Persist** — layout (positions, regions, links, zoom) saved to `storage.local`. On restart, live cards become ghost cards (faded; click to reopen).
10. **Restore a session** — select a region → "reopen all" → recreates the tabs.

## Data model
```ts
Card   = { tabId, url, title, favicon, thumb, x, y, w, h, updatedAt, alive: boolean }
Region = { id, name, color, cardIds: number[], collapsed: boolean }
Link   = { from: tabId, to: tabId }          // opener relationships
Layout = { cards: Record<number, Card>, regions: Region[], links: Link[], view: {x,y,z} }
```
Persisted globally (one canvas), with window as a group. Ghost cards: `alive:false`, kept for session memory.

## Key Firefox APIs
- `tabs.*` — `query`, `onCreated/onUpdated/onMoved/onRemoved/onActivated`; `captureTab(id)` for thumbnails of **any tab incl. background** (Firefox-only); `move`/`create`/`remove`/`update`.
- `windows.create({tabId, type:'popup', left,top,width,height})` — pop a card to a live pane.
- `windows.update` / `windows.remove` — move/resize/close pane.
- `windows.onBoundsChanged` — sync if user drags the popup (stretch).
- `tabs.move` — merge pane back into the main window.
- `storage.local` — layout graph.
- `commands` — hotkey; `action` — toolbar; `sidebar_action` — persistent mini-map (stretch).
- `webNavigation.onCompleted` — re-thumbnail after navigation.

## Open questions
- Global canvas vs per-window? — lean global, window as a region/group.
- On pane close, merge tab back vs close it? — lean merge back as background tab, keep card alive.
- Ghost cards on restart: how long to keep? auto-expire after N days?
- New-tab page takeover vs summoned page vs both? — lean both (new-tab page IS the canvas; hotkey summons it).
- Thumbnail cadence — `captureTab` is rate-limited (~2/s): refresh active tab on focus/navigation; background tabs on demand.

## Scope
**MVP:** cards from live tabs, pan/zoom/drag, click-to-pop-live at 90% with blurred canvas, escape-back, persist layout, hotkey summon.
**Stretch:** regions/groups, opener-links, ghost cards + session restore, multi-pane tile-live, sidebar mini-map, search/filter, containers-as-panes, saved spatial "views."
