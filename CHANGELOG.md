# POTAPlus (getontheair.app build) changelog

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
