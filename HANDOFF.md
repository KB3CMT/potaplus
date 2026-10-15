# HANDOFF: POTAPlus 1.10.0 (branch refactor/pota-app-1.10.0)

For: gota_POTA_PLUS (incoming maintainer). Prepared 2026-10-15 by the executor working for Curtis KB3CMT.

## State
- `main` is byte-identical to the v1.09.08 release (checked file by file against `releases/potaplus-1.09.08.zip`). The repo has no tags.
- **1.10.0 was published on getontheair.app on 2026-10-15** at Curtis's direction, before his hand test. Run the HAND-TEST checklist with him when he can. Don't merge or tag without his OK.
- Public downloads on getontheair.app: `potaplus.zip` and `potaplus-1.09.08.zip` (current), and `potaplus-1.09.04.zip` (the **only** fallback). **Never offer 1.09.05, 1.09.06 or 1.09.07.** They are withdrawn, even though `releases/` still has 1.09.06 and 1.09.07.
- The staged site deploy (zip, feed item, guide copy, deploy script and ROLLBACK) is on the shared box at `/workspace/potaplus-1100/stage/`. See its README.

## What pota.app looks like now (surveyed 2026-10-15)
- One Vue 3 + Vuetify 3 SPA on pota.app. next.pota.app still returns 200 with the same vendor bundles (only the index chunk hash differs), so it isn't a redirect yet. `#/...` URLs redirect to path routes.
- Spot rows are `tr[data-spot-activator]` with **extension hook attributes**: `ext-spot ext-actv ext-sptr ext-ref ext-freq ext-mode ext-band ext-time`. Each row also has empty `<span ext-slot="actv|freq|ref|comments|btn-hist|btn-acts|btn-spot">` placeholders. Prefer these to scraping, because they look intended for extensions.
- Built-in features we no longer duplicate: Band/Mode/Program/QRT/Age filters, Need/ATNO filter and pills, pin-to-top, hide hunted, N1CC chip, Op-to-Op chip, Repeat Offender chip, signal-report (RBN/PSKReporter) button, copy spot, column picker, spot history, card/list/map views, Rove planner.
- APIs (api.pota.app): `/v1/spots`, `/spot` (POST), `/user/award/progress[...]`, `/user/stats/hunted_activated_list`, `/user/logbook`, `/user/activations`, `/v1/spots/history`, `/park/all`, `/programs`, `/locations`, `/motd`, `/v1/rove`. Auth is Cognito (`cognito-idp.us-east-2`), with the JWT read by the existing page bridge.

## Code map
- `background.js` handles routing: `/` → foreground (spots), `/activations` → activations. Profile injection was removed.
- `include/potaplus-util.js` has the shared helpers (session/JWT, routes, layout detection, NOAA parsing).
- `foreground.js` is the spots page. The row loop is in the MutationObserver. It uses `hook('ref')` etc. and falls back to `mapTableColumns`.
- `activations.js` adds the WAS, Locations and Needed Parks badges on /activations (signed in only).
- `popup_*` is the toolbar popup (N1CC Activator, My Activations). It's unchanged.
- `tools/` has headless smoke tests (playwright-core with Chrome for Testing) and the eslint config.

## Known issues / next steps
1. Activations badges and every award badge need a signed-in session. Headless tests only cover signed-out use.
2. Version check: the background worker GETs `https://getontheair.app/downloads/potaplus-latest.json` (no callsign, options or settings), cached 24h including failures. **Bump that JSON on every release** (version, zip URL, sha256). dwestbrook.net was removed from host_permissions; only plain links to K2DW's page remain (proxy download/docs).
3. `foreground.js` still has dead or commented code from upstream (scan helpers, `if(0)` direct-log path). It's safe to prune further.
4. Card view (`.spot-card`) is only partly handled. Table view is the supported layout.
5. Lint: `npx eslint -c tools/eslint.config.mjs .` gives 0 errors. The remaining warnings are cross-file globals, plus implicit globals `tc`/`gc_tc` from upstream.

## Curtis hand-test checklist (Windows Chrome, signed in)
See `/workspace/potaplus-1100/stage/HAND-TEST.md` (also pasted in the PR description).
