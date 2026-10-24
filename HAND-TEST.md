# POTAPlus 1.11.0 signed-in test checklist (Windows, Chrome)

Setup: unzip `potaplus-1.11.0.zip` over your POTAPlus folder, open chrome://extensions, Reload the card, then hard-refresh https://pota.app/ (table view). Keep ham-apps-proxy running with your usual logger.

Headless signed-out checks already cover: toolbar next to View (not below the table), table/card QSY/QSL, US/EU/Custom presets, hunt key map, `L` opens QSL and does not fire while typing, ADIF geo helper, n-fer from `2-fer:` comments, Options toggles default on for upgrades, region checkboxes not all orange, next.pota.app still live, no toolbar on /profile /activations /map. Needed-only, per-callsign save, WAS/Locations badges, and live alerts need you signed in.

## 1.10.1 still works

1. **Sign-in:** The toolbar shows **v1.11.0** with no "PLEASE SIGN IN" banner. In F12 → Console, `MYCALL:` shows your callsign.
2. **Award / solar strip:** Inside the spots header card (with Band/Mode/Program), one compact row shows Parks Hunted / Late Shifts, the solar graphic, SFI/A/K, and an **Awards** / **New awards (N)** chip. No stacked black-bordered boxes under the header. The chip is collapsed by default. N should be 0 after the first load (your existing history is not "new"). Expand it: history is listed, **Show more** after about 10. Collapse it; refresh; it stays collapsed. A later new award should bump N until you open and close the chip.
3. **WAS / Locations badges:** an orange "WAS" or count badge appears in the Region cell (table) or by the park ref (card) for a state or location you still need.
4. **Region filter:** Options → Region filter is on. Check one region under HIDE SPOTS, and those spots disappear. Uncheck it and they come back. pota.app's own Band/Mode/Program/Hidden filters still have their labels.
5. **Hide coexistence:** pota.app's eye Hide button still works on a spot. QSY / QSL sit in the actions slot, not on top of Hide. Hidden filter still lists spots you hid.
6. **QSY:** click QSY on a spot. The rig moves to that frequency and mode, and the row turns green. Repeat in **Card** view (View picker → Card).
7. **QSL → Log:** click QSL on a spot (table and card). The POTAPlus log dialog opens (dark text on a light background). Fill in RSTs and click Log. The QSO lands in your logger with the right call, band, mode, park ref and comment.
8. **Spot+Log:** on an activator you really worked, Spot+Log logs the QSO **and** a re-spot appears on pota.app with your comment.
9. **SFI/A/K and solar widget:** both show values. They should not flicker or re-fetch every few seconds.
10. **Bio panels (Show selected activator profile):** clicking QSY fills the activator and park bio panels. Console should **not** show a burst of `/user/logbook` calls.
11. **Activations page** (https://pota.app/activations): WAS, Locations and Needed Parks badges show on scheduled activations. No POTAPlus toolbar appears there.
12. **Other pages:** Profile, /user/achievements/* and /map show no POTAPlus toolbar and no errors.
13. **Navigation:** go Spots → Activations → Spots **without** the tab doing a full reload. You get one toolbar on Spots (in the header next to View, not under the table), with no duplicate QSY/QSL buttons and no second info strip. Region filter stays just below the header card; SFI/awards stay inside the card.
14. **Toolbar popup:** the N1CC Activator and My Activations tabs load.
15. **Removed options:** Options no longer lists Needed N1CC/Ops, RBN/PSKReporter, Hide Spotter/Comments or Abbreviate Filter Labels.
16. **Console:** chrome://extensions shows no Errors button on the card. Spots page should stay quiet while ages tick from "now" to "1m".

## 1.11.0 features

17. **Region presets (Options → Region-filter presets):** on by default. Above HIDE SPOTS, click **US** — only US-xx spots remain. Click **EU** — DE/G/F/etc remain, US hides. Click **Needed only** — regions you already have (orange badge gone) hide; new locations stay. Click any region checkbox and the preset flips to **Custom**. Sign out (or a second browser profile) and set a different preset: each callsign, plus `_signedout`, keeps its own choice after a refresh.
18. **N-fer auto-fill (Options → N-fer auto-fill):** on by default. Find a 2-fer/`{Also: K-xxxx}` spot or a row whose `locationDesc` is real park refs (`K-1234,K-5678`), click QSL. Park Ref #2+ should fill. A comma location list like `US-CO,US-UT` must **not** invent park numbers. Turn the option off and those fields stay empty.
19. **ADIF STATE/DXCC (Options → ADIF STATE / DXCC):** on by default. Log a US-NY (or similar) spot and confirm the logger/QRZ record has DXCC 291 and STATE NY, unless you already set those in Additional logger fields (those win). US-AK / US-HI should use the DXCC exception (6 / 110) and not force STATE=AK/HI if that would be wrong for your logger — they send DXCC only. A VE spot should send VE_PROV. Turn the option off and those fields are absent unless you added them yourself.
20. **Hunt keys (Options → Keyboard hunt mode):** on by default. The spots page shows the key map. QSY a spot (row turns green), then press **L** — the log dialog opens for that call. Press **Esc** to close it. Click a comments/search box, type **L**, and confirm it types the letter and does not open QSL. Arrows / Ctrl-Space still QSY/scan only with rig control on, and also ignore inputs.
21. **Spot alerts (Options → Alert on a new needed ATNO or needed-region spot):** **off** until you enable it. Turn it on, leave Mute unchecked, throttle 15s. Refresh once (first paint is silent). When a new needed ATNO or needed-region spot appears, you get a bottom-right toast and a short beep. Mute stops the beep, toast still shows. The same call/park/region does not beep again in that tab. Signed out, nothing should fire.

Report any step that fails, along with a screenshot and the Console output.
