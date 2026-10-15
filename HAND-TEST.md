# POTAPlus 1.10.0: Curtis hand-test (Windows, Chrome, signed in to pota.app)

Setup: unzip `potaplus-1.10.0.zip` over your POTAPlus folder, open chrome://extensions, Reload the card, then hard-refresh https://pota.app/ (table view). Keep ham-apps-proxy running with your usual logger.

1. **Sign-in:** The toolbar shows **v1.10.0** with no "PLEASE SIGN IN" banner. In F12 → Console, `MYCALL:` shows KB3CMT.
2. **Award widgets:** Parks Hunted / Late Shifts show real numbers, and New awards earned has no empty bullets.
3. **WAS / Locations badges:** an orange "WAS" or count badge appears in the Region cell for a state or location you still need.
4. **Region filter:** Options → Region filter is on. Check one region under HIDE SPOTS, and those spots disappear. Uncheck it and they come back. pota.app's own Band/Mode/Program filters still have their labels.
5. **QSY:** click QSY on a spot. The rig moves to that frequency and mode, and the row turns green.
6. **QSL → Log:** click QSL on a spot. The POTAPlus log dialog opens (dark text on a light background). Fill in RSTs and click Log. The QSO lands in your logger with the right call, band, mode, park ref and comment. Try a 2-fer with Park Ref #2 too.
7. **Spot+Log:** on an activator you really worked, Spot+Log logs the QSO **and** a re-spot appears on pota.app with your comment.
8. **SFI/A/K and solar widget:** both show values.
9. **Bio panels (Show selected activator profile):** clicking QSY fills the activator and park bio panels.
10. **Activations page** (https://pota.app/activations): WAS, Locations and Needed Parks badges show on scheduled activations. No POTAPlus toolbar appears there.
11. **Other pages:** Profile, /user/achievements/* and /map show no POTAPlus toolbar and no errors. The Achievements list isn't scrambled.
12. **Navigation:** go Spots → Activations → Spots without reloading the tab. You get one toolbar, with no duplicate QSY/QSL buttons.
13. **Toolbar popup:** the N1CC Activator and My Activations tabs load.
14. **Removed options:** Options no longer lists Needed N1CC/Ops, RBN/PSKReporter, Hide Spotter/Comments or Abbreviate Filter Labels. Confirm you're OK leaving those to pota.app's NEED pill, N1CC/Op-to-Op chips, signal-report button and Choose Columns.
15. **Console:** chrome://extensions shows no Errors button on the card.

Report any step that fails, along with a screenshot and the Console output.
