# Mesa — TODO

## Spike (current)
- [x] cards from live tabs, thumbnails, drag
- [x] in-window 90%/blur focus mode (content-script, document_start)
- [x] force body as scroller so the frame is viewport-fixed (no spill)
- [x] persist thumbnails + layout in storage.local
- [x] **key by URL** so layout/thumbs survive a browser restart and revisit restores
- [ ] same-URL tabs overlap (share position) — offset duplicates, or key by url+tabId hybrid
- [ ] bound storage growth: url-keyed thumbs/layout never cleared now; add LRU/expiry
- [ ] captureTab on navigation is throttled 600ms — refresh feels slow on rapid nav; tune

## Feel / UX to decide
- [ ] 90% / blur-18px right? top-aligned vs centered frame?
- [ ] Esc → back to map (current) vs restore page + stay on tab
- [ ] click blurred margin to exit (current) — keep?
- [ ] scroll-speed is ~0.9x under paint-only scale — acceptable, or invest in wrapper approach for 1:1

## MVP (port spike approach into real build)
- [ ] scaffold WXT + tldraw + webextension-polyfill (TS, MV2)
- [ ] tldraw custom `tab-card` shape (thumbnail + title + favicon + close)
- [ ] real infinite pan/zoom (tldraw) replacing the fixed grid
- [ ] focus mode as a content-script module (port focus.js) triggered from tldraw card click
- [ ] hotkey to summon canvas; new-tab override = canvas
- [ ] close card closes the real tab
- [ ] new tab from canvas (double-click empty → url/search)

## Stretch
- [ ] regions/groups (box a cluster, label, collapse)
- [ ] opener links (B opened from A → arrow via openerTabId)
- [ ] ghost cards for closed tabs (faded; click to reopen) + session restore
- [ ] multi-pane "tile live" (N cards live at once)
- [ ] sidebar mini-map (persistent spatial layer)
- [ ] search/filter cards
- [ ] containers-as-panes (Firefox contextualIdentities)
- [ ] saved spatial "views" (zoom region + camera)
- [ ] URL-keying edge cases: normalize trailing slash / strip query for friendlier keys
