import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'include/potaplus-util.js'), 'utf8');
const ctx = {
  console,
  chrome: { runtime: { sendMessage() {}, lastError: null, getURL: () => '' } },
  document: {
    cookie: '',
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener() {},
  },
  window: {
    addEventListener() {},
    localStorage: { getItem() { return null; } },
    sessionStorage: { getItem() { return null; } },
  },
  location: { hostname: 'pota.app', pathname: '/', href: 'https://pota.app/' },
  setTimeout,
  clearTimeout,
};
vm.createContext(ctx);
vm.runInContext(src, ctx);

const fail = [];
function eq(name, got, want) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g !== w) fail.push(`${name}: got ${g} expected ${w}`);
}

eq('nfer ignores location codes', ctx.nferParkRefs('K-1001', 'US-CO,US-UT', ''), []);
eq(
  'nfer from 2-fer comment',
  ctx.nferParkRefs('US-0064', 'US-VA', '2-fer: US-0064 US-4556'),
  ['US-4556']
);
eq('strip leading ref only', ctx.stripLeadingParkRef('US-0064 Shenandoah National Park'), 'Shenandoah National Park');
eq('normalize keeps full name', ctx.normalizeParkName('Shenandoah National Park', false), 'Shenandoah National Park');
eq('normalize strips ref', ctx.normalizeParkName('US-0064 Shenandoah National Park', false), 'Shenandoah National Park');
eq('highlight needs a list', ctx.shouldHighlightUnhuntedRegion(null), false);
eq('highlight with list', ctx.shouldHighlightUnhuntedRegion([]), true);
eq('loose parent main', ctx.isLoosePotaPlusParent({ tagName: 'MAIN', id: '', classList: { contains() { return false; } } }), true);
eq('header-actions not loose', ctx.isLoosePotaPlusParent({ tagName: 'SPAN', id: '', classList: { contains() { return false; } } }), false);
const combo = { tagName: 'DIV', isContentEditable: false, closest(sel) { return sel.indexOf('combobox') !== -1 ? this : null; } };
eq('typing combobox', ctx.isTypingTarget(combo), true);
eq(
  'nfer from comma park refs',
  ctx.nferParkRefs('K-1001', 'K-2002,K-3003', ''),
  ['K-2002', 'K-3003']
);
eq(
  'nfer from Also and extra text',
  ctx.nferParkRefs('K-1001', 'US-CO', '{Also: K-2222, K-3333} plus K-1001'),
  ['K-2222', 'K-3333']
);
eq('nfer caps at 4 extras', ctx.nferParkRefs('K-1001', 'K-2002,K-3003,K-4004,K-5005,K-6006', '').length, 4);

const ny = ctx.adifGeoFromRegion('US-NY');
eq('NY dxcc', ny && ny.dxcc, 291);
eq('NY state', ny && ny.state, 'NY');
const ak = ctx.adifGeoFromRegion('US-AK');
eq('AK dxcc exception', ak && ak.dxcc, 6);
eq('AK no state overwrite of KH6/KL7 style', ak && ak.state, '');
const on = ctx.adifGeoFromRegion('CA-ON');
eq('ON ve_prov', on && on.ve_prov, 'ON');
eq('ON dxcc', on && on.dxcc, 1);
const de = ctx.adifGeoFromRegion('DE-HE');
eq('DE dxcc', de && de.dxcc, 230);

let fields = ctx.appendAdifGeoFields('', 'US-NY');
eq('append STATE', /STATE=NY/.test(fields), true);
eq('append DXCC', /DXCC=291/.test(fields), true);
eq('no overwrite STATE', ctx.appendAdifGeoFields('&STATE=ME', 'US-NY').indexOf('STATE=NY'), -1);

eq('US preset hides EU', ctx.regionPresetHideMap('us', ['US-NY', 'DE-HE', 'G-ENG'], null)['DE-HE'], true);
eq('US preset keeps US', ctx.regionPresetHideMap('us', ['US-NY', 'DE-HE'], null)['US-NY'], undefined);
eq('EU preset keeps DE', ctx.regionMatchesPreset('eu', 'DE-HE', null), true);
eq('EU preset drops US', ctx.regionMatchesPreset('eu', 'US-NY', null), false);
eq(
  'needed-only hides hunted',
  ctx.regionMatchesPreset('needed', 'US-NY', [{ locationDesc: 'US-NY' }]),
  false
);
eq(
  'needed-only keeps new',
  ctx.regionMatchesPreset('needed', 'US-AK', [{ locationDesc: 'US-NY' }]),
  true
);
eq('needed-only unknown lists show', ctx.regionMatchesPreset('needed', 'US-NY', null), true);

eq('user key signed out', ctx.userFilterKey(''), '_signedout');
eq('user key call', ctx.userFilterKey('kb3cmt'), 'KB3CMT');

const older = { dateGranted: '2026-01-01T00:00:00', awardName: 'Hunter 1', badgeNum: 1 };
const newer = { dateGranted: '2026-03-01T00:00:00', awardName: 'Hunter 3', badgeNum: 3, endorsements: 'PHONE' };
const sameDay = { dateGranted: '2026-01-01T12:00:00', awardName: 'Hunter 1b', badgeNum: 2 };
eq('award id stable', ctx.earnedAwardId(older), ctx.earnedAwardId({ dateGranted: '2026-01-01T00:00:00', awardName: 'Hunter 1', badgeNum: 1 }));
eq('empty last-seen is not new', ctx.filterNewEarnedAwards([older, newer], {}).length, 0);
const seeded = ctx.snapshotAwardsLastSeen([older]);
eq('seed has date', !!seeded.date, true);
eq('seeded same list is not new', ctx.filterNewEarnedAwards([older], seeded).length, 0);
eq('newer than last-seen counts', ctx.filterNewEarnedAwards([older, newer], seeded).map(ctx.earnedAwardId), [ctx.earnedAwardId(newer)]);
eq('same-day unseen id counts', ctx.filterNewEarnedAwards([older, sameDay], seeded).length, 1);
eq('chip zero', ctx.awardsChipLabel(0), 'Awards');
eq('chip n', ctx.awardsChipLabel(3), 'New awards (3)');
const hist = Array.from({ length: 12 }, (_, i) => ({ dateGranted: '2026-01-' + String(i + 1).padStart(2, '0'), awardName: 'A' + i }));
eq('history cap 10', ctx.sliceAwardsHistory(hist, 10).visible.length, 10);
eq('history remaining', ctx.sliceAwardsHistory(hist, 10).remaining, 2);
eq('show more reveals rest', ctx.sliceAwardsHistory(hist, 20).remaining, 0);
eq('panel default closed', ctx.awardsPanelOpenForUser({}, 'KB3CMT'), false);
eq('panel open stored', ctx.awardsPanelOpenForUser(ctx.setAwardsPanelOpenMap({}, 'kb3cmt', true), 'KB3CMT'), true);
eq('last-seen per callsign', ctx.awardsLastSeenForUser(ctx.setAwardsLastSeenMap({}, 'kb3cmt', seeded), 'KB3CMT').ids.length > 0, true);

const input = { tagName: 'INPUT', isContentEditable: false, closest() { return null; } };
eq('typing input', ctx.isTypingTarget(input), true);
eq('typing button', ctx.isTypingTarget({ tagName: 'BUTTON', isContentEditable: false, closest() { return null; } }), false);
eq('typing body', ctx.isTypingTarget({ tagName: 'BODY', isContentEditable: false, closest() { return null; } }), false);

const atno = ctx.potaplusSpotAlertKind('K-9', 'US-AK', [], []);
eq('empty hunter lists are all needed', atno, 'atno+region');
eq('unloaded lists no kind', ctx.potaplusSpotAlertKind('K-9', 'US-AK', null, null), null);
eq(
  'worked park + hunted region quiet',
  ctx.potaplusSpotAlertKind('K-1', 'US-NY', [{ reference: 'K-1' }], [{ locationDesc: 'US-NY' }]),
  null
);

const seen = {};
const seed = ctx.potaplusSpotAlertDecide({
  enabled: true, mute: false, throttleSec: 15, lastTs: 0, now: 1000, seeded: false, seen, key: 'A', kind: 'atno',
});
eq('first paint seeds', seed.reason, 'seed');
seen.A = true;
eq(
  'dup blocked',
  ctx.potaplusSpotAlertDecide({
    enabled: true, mute: false, throttleSec: 15, lastTs: 0, now: 2000, seeded: true, seen, key: 'A', kind: 'atno',
  }).reason,
  'dup'
);
eq(
  'throttle marks',
  ctx.potaplusSpotAlertDecide({
    enabled: true, mute: false, throttleSec: 15, lastTs: 9000, now: 10000, seeded: true, seen: {}, key: 'B', kind: 'region',
  }).reason,
  'throttle'
);
const fire = ctx.potaplusSpotAlertDecide({
  enabled: true, mute: true, throttleSec: 15, lastTs: 0, now: 20000, seeded: true, seen: {}, key: 'C', kind: 'atno',
});
eq('fire muted', fire.alert && fire.beep === false, true);
eq('opt-in off', ctx.potaplusSpotAlertDecide({ enabled: false, kind: 'atno', key: 'D' }).reason, 'off');

const opts = ctx.setOptionsDefaults({});
eq('alerts default off', opts.enableSpotAlerts, false);
eq('presets default on', opts.enableRegionPresets, true);
eq('throttle default', opts.spotAlertThrottleSec, 15);

if (fail.length) {
  console.error(fail.join('\n'));
  process.exit(1);
}
console.log('feature-helpers-test OK');
