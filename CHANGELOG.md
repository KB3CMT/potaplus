# POTAPlus (getontheair.app build) changelog

## Unreleased — changes from WD4DAN

**dev.pota.app**
Runs on dev.pota.app and calls devapi.pota.app there (`POTA_API` in
potaplus-util.js; api.pota.app everywhere else). The page saves `POTA_API` next
to `TOKEN`, so the popup calls the API that issued the stored token.

**ACLog proxy option**
Options > ACLog proxy (Rig Control and Logging): *official K2DW ham-apps-proxy*
(default) or *ham-apps-proxy-wd4dan (modified)*, added as
`ham-apps-proxy/src/ham-apps-proxy-wd4dan.pl`, with a built exe in
`ham-apps-proxy/releases/ham-apps-proxy-1.08.01-wd4dan.zip`. See ham-apps-proxy/README.md.
With the modified proxy, logging fills ACLog's entry form field by field
(including comments and `Other1=...`-style extra fields). Each additional
operator's QSO goes to ACLog 2 s after the previous one.

**ACLog QSY lands on the spot frequency**
QSY sends the mode first, then the frequency, then the frequency again 500 ms
later. Yaesu radios move the VFO by the CW pitch when switching CW/SSB, and a
frequency sent mid-switch landed 650 Hz off (seen on an FTDX101D).

**TX CLAR offset on CW spots** (Rig Control, ACLog only, off by default)
Turns on the Yaesu TX clarifier at a set offset (-9999..9999 Hz) when QSYing to a
CW spot, and turns it off and clears it for other modes. Uses ACLog
SENDRIGCOMMAND with CF commands (FTDX10 / FTDX101 / FT-710, the default) or
RU/RD (FT-991A and older). On an FTDX101D, CF works and RU/RD are ignored.

**Multi-operator spots**
QSL pre-fills Other Ops from the spot's `operators` field, read from pota.app's
Pinia spots store via the page bridge (no extra API call). A null `operators`
value falls back to the activator. Re-spot sends `activator` as
"CALL1, CALL2, ...", the same as pota.app's own form, so the other operators are
kept. Logging skips duplicate calls.

**Re-spots say they came from POTA Plus**
Spots posted by POTA Plus (Spot+Log) send `source: "potaplus"` instead of
`"Web"`, the way other apps send their own names (Ham2K Portable Logger,
POTAtte, ...).

**Re-spot updates the list**
After a successful POTAPlus re-spot, the page bridge calls pota.app's
`getSpots({fresh:true})` and `addHunted(spot)`, as the site's own Re-Spot does,
so the spot is marked hunted and hidden when hunted spots are hidden.

**Button placement**
QSY goes before the frequency, at the start of the element that holds
`ext-slot="freq"`. QSL goes in `ext-slot="btn-spot"`. `findRespotButton()`
skips POTAPlus's own buttons.

**Follows pota.app's light/dark theme**
The QSL dialog lives inside `.v-application` and uses Vuetify theme variables,
so it follows the site theme, including live switches. Region filter panel,
region preset buttons, hunt-key map, awards chip/link, row toggle and SCAN
selector use the same variables. The dialog fits narrow screens.

**Disabled widgets stay quiet**
The solar (rigreference.com) and grey-line (timeanddate.com) images load only
when their option is on. Hidden images still download, so they now use
`data-src`. The NOAA SFI/A/K fetch waits for options and runs only when
"Show SFI/A/K Info" is on.

## v1.11.0 — 2026-10-23

Five hunter features on the 1.10.1 pota.app / performance base. Each one has an
Options toggle. None of them copy pota.app's own Band/Mode/Program/Need/ATNO,
Hide/Hidden, N1CC, Op-to-Op, RBN/PSKReporter, or column picker.

**Region-filter presets** (on by default)
US / EU / Needed only / Custom buttons above HIDE SPOTS. US and EU use static
program prefixes (no extra `/locations` fetch). Needed only hides regions already
in your hunted-locations list (signed-in). The chosen preset and any custom hide
map are stored per callsign (`_signedout` when nobody is signed in). Clicking a
region checkbox switches to Custom.

**N-fer auto-fill** (on by default)
QSL fills Park Ref #2–#5 from extra `XX-1234` refs in `locationDesc`, `{Also:}`
comments, and the spot row. Location codes such as `US-CO,US-UT` are not turned
into park refs.

**ADIF STATE / DXCC** (on by default)
Log URLs get `DXCC`, plus `STATE` for `US-xx` and `VE_PROV` for `CA-xx`, from a
static map (including KH6/KL7/KP4-style US exceptions). Existing
`additionalADIFFields` values are left alone.

**Keyboard hunt mode** (on by default)
`L` opens QSL for the selected spot (or the first visible one). Options and the
spots page show the key map (`L`, arrows, Ctrl-Space, Esc). Keys are ignored
while typing in an input/textarea/select/contenteditable and while a dialog is
open.

**Needed-spot alerts** (off by default)
Opt-in toast plus a short Web Audio beep when a new needed ATNO or needed-region
spot appears after the first paint. Mute silences the beep. Default throttle is
15 seconds. Each call/park/region is alerted at most once per tab. No
`notifications` permission. Signed-out (hunter lists unloaded) is a no-op.

**Audit fixes (same 1.11.0)**
- Toolbar / widgets / Region filter / hunt-key map are re-homed once
  `.header-actions` and `.pota-panel` exist, so they sit in the spots header
  instead of after the table (early inject used to append them to `main`).
- Options page applies the same defaults as the content scripts, so the new
  toggles show on for upgrades from 1.10.x.
- Signed-out region checkboxes are no longer all painted orange.
- Log comments keep the full park name (`Shenandoah National Park`, not
  `National Park`).
- `2-fer: US-0064 US-4556` comments fill Park Ref #2 (already worked via the
  spot row; covered by tests).
- Hunt keys use `addEventListener` (do not replace `document.onkeydown`) and
  ignore Vuetify combobox/search fields.
- Hunter-list cache hits trigger a repaint so Needed-only / badges / alerts
  do not wait for the next spots mutation.
- The unused 300px debug log box is hidden unless Debugging mode is on.
- Parks Hunted / Late Shifts, the solar graphic, SFI/A/K, and awards sit in
  one compact info strip inside `.pota-panel` (flex, wraps on a narrow
  window). No stacked black-bordered boxes under the header.
- Awards are a collapsed-by-default `New awards (N)` chip. N counts only
  awards newer than the last-seen date/ids for that callsign (first fetch
  seeds last-seen and does not dump history). Expanding shows full history
  with Show more after 10; expanded/collapsed state is stored per callsign.

**Not changed**
Observer is still `main` / `childList` only, debounced, with `data-potaplus-key`
and `potaplus-paint`. No new polling or `/locations` traffic.

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
