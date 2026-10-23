# POTAPlus 1.10.1: Curtis hand-test (Windows, Chrome, signed in to pota.app)

Setup: unzip `potaplus-1.10.1.zip` over your POTAPlus folder, open chrome://extensions, Reload the card, then hard-refresh https://pota.app/ (table view). Keep ham-apps-proxy running with your usual logger.

Headless signed-out checks already cover: table hooks, card-view QSY/QSL, Region filter chrome, next.pota.app still live, no toolbar on /profile /activations /map, no `www.pota.app` permission.

1. **Sign-in:** The toolbar shows **v1.10.1** with no "PLEASE SIGN IN" banner. In F12 → Console, `MYCALL:` shows KB3CMT.
2. **Award widgets:** Parks Hunted / Late Shifts show real numbers, and New awards earned has no empty bullets.
3. **WAS / Locations badges:** an orange "WAS" or count badge appears in the Region cell (table) or by the park ref (card) for a state or location you still need.
4. **Region filter:** Options → Region filter is on. Check one region under HIDE SPOTS, and those spots disappear. Uncheck it and they come back. pota.app's own Band/Mode/Program/Hidden filters still have their labels.
5. **Hide coexistence:** pota.app's eye Hide button still works on a spot. QSY / QSL sit in the actions slot, not on top of Hide. Hidden filter still lists spots you hid.
6. **QSY:** click QSY on a spot. The rig moves to that frequency and mode, and the row turns green. Repeat in **Card** view (View picker → Card).
7. **QSL → Log:** click QSL on a spot (table and card). The POTAPlus log dialog opens (dark text on a light background). Fill in RSTs and click Log. The QSO lands in your logger with the right call, band, mode, park ref and comment. Try a 2-fer with Park Ref #2 too.
8. **Spot+Log:** on an activator you really worked, Spot+Log logs the QSO **and** a re-spot appears on pota.app with your comment.
9. **SFI/A/K and solar widget:** both show values. They should not flicker or re-fetch every few seconds.
10. **Bio panels (Show selected activator profile):** clicking QSY fills the activator and park bio panels. Console should **not** show a burst of `/user/logbook` calls.
11. **Activations page** (https://pota.app/activations): WAS, Locations and Needed Parks badges show on scheduled activations. No POTAPlus toolbar appears there.
12. **Other pages:** Profile, /user/achievements/* and /map show no POTAPlus toolbar and no errors. The Achievements list isn't scrambled.
13. **Navigation:** go Spots → Activations → Spots **without** the tab doing a full reload. You get one toolbar on Spots, with no duplicate QSY/QSL buttons. (1.10.0 reloaded the page on each switch.)
14. **Toolbar popup:** the N1CC Activator and My Activations tabs load.
15. **Removed options:** Options no longer lists Needed N1CC/Ops, RBN/PSKReporter, Hide Spotter/Comments or Abbreviate Filter Labels. Confirm you're OK leaving those to pota.app's NEED pill, N1CC/Op-to-Op chips, signal-report button, Choose Columns, and the new Hide / Hidden filter.
16. **Console:** chrome://extensions shows no Errors button on the card. Spots page should stay quiet while ages tick from "now" to "1m".

Report any step that fails, along with a screenshot and the Console output.
