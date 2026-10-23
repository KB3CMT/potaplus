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
