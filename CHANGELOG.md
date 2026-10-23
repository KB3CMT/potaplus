# POTAPlus (getontheair.app build) changelog

## v1.10.1 — 2026-10-23

Follow-up after the 1.10.0 unified-site release. pota.app's hooks are unchanged;
this build matches the live site as of 2026-10-23, finishes card-view chrome, and
cuts observer / API waste.

**Site since 1.10.0 (surveyed signed-out 2026-10-23)**
- Official **Hide** button on every card/table/list/map spot, plus a **Hidden**
  filter (changelog 2026-10-21). Works signed out; 6-hour localStorage TTL. No
  `ext-slot` for hide. POTAPlus does not duplicate this.
- Band/Mode/Program **All** is a real toggle; empty-state explains active filters;
  table/list sort is click / shift-click; multi-op spots keep extra operators and
  highlight when you are listed (2026-10-18).
- Spots refresh is 60s (120s on a slow link). Map view is Flat or Globe.
- `next.pota.app` still serves the same SPA (HTTP 200, no redirect). `www.pota.app`
  no longer resolves. `#/...` still rewrites to path routes.
- Extension hooks are unchanged: `ext-actv|sptr|ref|freq|mode|band|time` plus
  `ext-slot` `actv|freq|ref|comments|btn-hist|btn-acts|btn-spot`. Card view puts
  those attributes on the wrapping `v-col`, not on `.spot-card`.
- `GET /park/all` now returns JSON `null`. POTAPlus already used `/park/{ref}`.

**Not dropped (still unique to POTAPlus)**
Sign-in / page bridge, QSY, ham-apps-proxy + QRZ logging, Spot+Log, SFI/A/K,
RigRef solar, Region filter, Activations WAS/Locations/Needed Parks badges.

**Dropped / evidence**
- `https://www.pota.app/*` host permission: DNS gone (curl cannot resolve).
- Hunter logbook crawl on QSY (`/user/logbook` paging per callsign): the Op-to-Op
  count it fed was `display:none`, and pota.app's Op-to-Op chip is the real UI.
- Unused N1CC cache read on `/activations` (no badge rendered there).
- Full-page reload when switching Spots ↔ Activations: background now injects on
  SPA URL changes; each script already self-guards.

**Fixed**
- Card view: QSY / QSL / QRZ / Region hide / WAS and Locations badges read hooks
  on the card host and inject into `ext-slot` placeholders.
- `PARKS_HUNTED.find` / `LOCATIONS_HUNTED.find` when those lists are still null
  (signed-out or cache not back yet).
- QSY/QSL no longer sit on top of the official Hide button (`btn-acts` slot).
- SPA navigation no longer reloads the tab.

**Performance**
- MutationObserver watches `main` for `childList` only (no `characterData`),
  ignores POTAPlus's own nodes, and debounces paints. Rows are keyed
  (`data-potaplus-key`) so Vue age ticks do not rebuild every button.
- Region filter HTML is rebuilt only when the region set changes.
- NOAA / solar fetch is once per page, not on every observer tick.
- `pokeMainTable` dispatches `potaplus-paint` instead of appending a text node
  (which used to retrigger the observer).

## v1.10.0 — 2026-10-15

pota.app moved the former next.pota.app beta onto the main site (Vue 3 / Vuetify 3, path routes). The
classic Vuetify 2 site is gone, and old `#/` links now redirect. This release removes code for the old site
and drops features that pota.app now has built in.

**Removed because pota.app now does it**
- Needed Parks badge on the spots page: use pota.app's NEED and ATNO pills and the Need/ATNO filter, plus the Repeat Offender count chip. The badge stays on the Activations page, which has no built-in equivalent.
- Needed N1CC badge: use pota.app's N1CC chip (bands hunted at the park). This also removes the per-park logbook crawl that ran behind it.
- Needed Ops badge: use pota.app's Op-to-Op chip.
- RBN and PSKReporter icons: use pota.app's signal-report button on each spot.
- Hide Spotter and Hide Comments options: use pota.app's Choose Columns picker.
- Band, Mode and Program hide-spot filters: these are built in. POTAPlus keeps only the **Region** filter.
- Abbreviate Filter Labels: on the new site it hid the labels of pota.app's own filters.
- Profile page injection (`profile.js`): pota.app has award progress, earned and geographic pages.

**Removed because it only worked on the old site**
- Hijacking the Re-Spot dialog. Every QSL click now opens the POTAPlus log dialog (Log / Spot+Log).
- Vuetify 2 selectors (`v-card__*`, `v-data-table__wrapper`, `layout row wrap`, `theme--dark`, `.v-btn--fab/--outlined`), the fixed-column row parser, the "Active Spots" toolbar anchor, hash-route parsing, `isNextPota()`/`IS_NEXT` branches.

**Changed**
- Spot rows are read from pota.app's extension hook attributes (`ext-actv`, `ext-ref`, `ext-freq`, `ext-mode`, `ext-band`, plus the `ext-slot` spans), and fall back to column headers.
- The late/early-shift marker works with the site's short ages ("now", "5m").
- The version label comes from the manifest.
- The update check now reads `getontheair.app/downloads/potaplus-latest.json` at most once a day and sends nothing about you. Before, it sent your callsign and options to dwestbrook.net, which is no longer in the permissions.
- Fixed the signed-out `TypeError`s on first load (`PARK_INFO` null, `LOCATIONS_HUNTED.find`).

**Kept:** sign-in fix and page bridge, QSY (Commander/OmniRig/ACLog/Logger32), logging via K2DW's ham-apps-proxy and QRZ, Spot+Log (`POST api.pota.app/spot`), the SFI/A/K widget, RigRef solar widget, UTC clock, My Awards and New awards widgets, WAS and Locations badges, the band-edge warning, the QRZ icon, scan, row toggles, the activator and park bio panels, the toolbar popup, and options storage.

next.pota.app still serves the same build, so it stays in the host permissions.
