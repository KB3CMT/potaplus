import { chromium } from 'playwright-core';
import fs from 'fs';

const chrome =
  process.env.CHROME ||
  [
    '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p));
const ext = process.env.EXT || process.cwd();
const ud = '/tmp/pp-feat-1110';
fs.rmSync(ud, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(ud, {
  executablePath: chrome,
  headless: true,
  args: [
    '--headless=new',
    '--disable-features=DisableLoadExtensionCommandLineSwitch',
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`,
    '--no-sandbox',
    '--disable-gpu',
    '--disable-dev-shm-usage',
  ],
  ignoreDefaultArgs: ['--disable-extensions'],
  viewport: { width: 1400, height: 900 },
});
let sw = ctx.serviceWorkers()[0];
if (!sw) {
  try {
    sw = await ctx.waitForEvent('serviceworker', { timeout: 25000 });
  } catch (e) {
    const boot = await ctx.newPage();
    await boot.goto('chrome://extensions', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await boot.waitForTimeout(2000);
    sw = ctx.serviceWorkers()[0];
    await boot.close().catch(() => {});
  }
}
if (!sw) throw new Error('extension service worker did not start');
await new Promise((r) => setTimeout(r, 800));
await sw.evaluate(async () => {
  const cur = (await chrome.storage.local.get('options')).options || {};
  await chrome.storage.local.set({
    options: {
      ...cur,
      enableSpotFilters: true,
      enableRegionPresets: true,
      enableNferAutofill: true,
      enableAdifGeo: true,
      enableHuntKeys: true,
      enableSpotAlerts: true,
      spotAlertMute: true,
      spotAlertThrottleSec: 15,
      enableLogging: true,
      enableQsy: true,
      enableIconQRZ: true,
      qsyConfig: { ...(cur.qsyConfig || {}), method: 'omnirig', proto: 'http', host: '127.0.0.1', port: '8073' },
      loggingConfig: { ...(cur.loggingConfig || {}), method: 'log4om', proto: 'http', host: '127.0.0.1', port: '8073', additionalADIFFields: {} },
    },
  });
});

const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('https://pota.app/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await p.waitForSelector('[data-marker=QSL_BTN]', { timeout: 45000 });
await p.waitForTimeout(2500);

const before = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('tr[data-spot-activator], [data-spot-activator]')];
  const visible = rows.filter((r) => {
    const outer = r.closest('[data-spot-activator], .v-col') || r;
    return getComputedStyle(outer).display !== 'none';
  }).length;
  return {
    ver: document.getElementById('label_ver')?.innerText,
    presets: [...document.querySelectorAll('[data-region-preset]')].map((b) => b.getAttribute('data-region-preset')),
    huntKeys: document.getElementById('potaplus_hunt_keys')?.innerText || '',
    toastOn: !!document.querySelector('#potaplus_spot_alert.potaplus-spot-alert-on'),
    qsl: document.querySelectorAll('[data-marker=QSL_BTN]').length,
    visible,
    rows: rows.length,
  };
});

await p.click('[data-region-preset="us"]');
await p.waitForTimeout(800);
const afterUs = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('tr[data-spot-activator], [data-spot-activator]')];
  const visible = rows.filter((r) => {
    const outer = r.closest('[data-spot-activator], .v-col') || r;
    return getComputedStyle(outer).display !== 'none';
  });
  return {
    visible: visible.length,
    pressed: document.querySelector('[data-region-preset="us"]')?.getAttribute('aria-pressed'),
    nonUsHidden: visible.length < rows.length || rows.length === 0,
  };
});
await p.click('[data-region-preset="custom"]');
await p.waitForTimeout(600);

await p.evaluate(() => {
  const btns = [...document.querySelectorAll('[data-marker=QSL_BTN]')];
  const vis = btns.find((b) => {
    const row = b.closest('tr, [data-spot-activator], .v-col') || b;
    const region = b.getAttribute('data-park_region') || '';
    return getComputedStyle(row).display !== 'none' && /^US-[A-Z]{2}$/i.test(region) && !/^US-(AK|HI|PR|VI|GU|MP|AS|UM)$/i.test(region);
  }) || btns.find((b) => {
    const row = b.closest('tr, [data-spot-activator], .v-col') || b;
    return getComputedStyle(row).display !== 'none';
  });
  if (vis) vis.click();
});
await p.waitForTimeout(800);
const dialog = await p.evaluate(() => {
  const dlg = document.querySelector('[data-potaplus-log-dialog]');
  const url = dlg && (dlg.querySelector('input[data-URL]')?.getAttribute('data-URL') || '');
  return dlg
    ? {
        parks: ['PARKNUM2', 'PARKNUM3', 'PARKNUM4', 'PARKNUM5'].map((id) => document.getElementById(id)?.value ?? null),
        nferNote: /N-fer auto-fill/i.test(dlg.innerText),
        url: (url || '').slice(0, 500),
        hasDxcc: /[?&]DXCC=/i.test(url || ''),
        hasState: /[?&]STATE=/i.test(url || ''),
        visible: true,
      }
    : { visible: false, url: '', hasDxcc: false, hasState: false };
});

const rst = await p.$('#RST_RCVD');
let typedL = { openedSecond: false };
if (rst) {
  await rst.click();
  await rst.type('L');
  await p.waitForTimeout(300);
  typedL = await p.evaluate(() => ({
    rst: document.getElementById('RST_RCVD')?.value,
    dialogs: document.querySelectorAll('[data-potaplus-log-dialog]').length,
  }));
}

await p.keyboard.press('Escape');
await p.waitForTimeout(400);
await p.evaluate(() => {
  const el = document.getElementById('potaplus_hunt_keys') || document.getElementById('potaplus_toolbar');
  if (el) el.click();
});
await p.keyboard.press('l');
await p.waitForTimeout(700);
const afterL = await p.evaluate(() => ({
  dialog: !!document.querySelector('[data-potaplus-log-dialog]'),
}));

const opt = await ctx.newPage();
await opt.goto(`chrome-extension://${sw.url().split('/')[2]}/options.html`);
await opt.waitForTimeout(800);
const optionsUi = await opt.evaluate(() => ({
  presets: !!document.getElementById('enableRegionPresets'),
  nfer: !!document.getElementById('enableNferAutofill'),
  geo: !!document.getElementById('enableAdifGeo'),
  hunt: !!document.getElementById('enableHuntKeys'),
  alerts: !!document.getElementById('enableSpotAlerts'),
  mute: !!document.getElementById('spotAlertMute'),
  throttle: !!document.getElementById('spotAlertThrottleSec'),
  keymap: /Hunt key map/i.test(document.body.innerText),
}));
await opt.close();

const out = { before, afterUs, dialog, typedL, afterL, optionsUi, errors: errs };
const fail = [];
if (before.ver && !/1\.11\.0/.test(before.ver)) fail.push('version ' + before.ver);
if (before.presets.join(',') !== 'us,eu,needed,custom') fail.push('presets ' + before.presets);
if (!/Log the selected spot/i.test(before.huntKeys)) fail.push('hunt keymap missing');
if (before.toastOn) fail.push('alert toast on first paint');
if (!afterUs.pressed || afterUs.pressed !== 'true') fail.push('US preset not pressed');
if (!dialog.visible) fail.push('QSL dialog missing');
if (dialog.parks.some((v) => v == null)) fail.push('park ref fields missing');
if (!dialog.hasDxcc) fail.push('ADIF DXCC missing from log URL ' + (dialog.url || ''));
if (!dialog.hasState) fail.push('ADIF STATE missing from log URL ' + (dialog.url || ''));
if (typedL.rst && /l/i.test(typedL.rst) && typedL.dialogs > 1) fail.push('L while typing opened another dialog');
if (typedL.dialogs > 1) fail.push('second dialog while typing');
if (!afterL.dialog) fail.push('L did not open log dialog');
if (!optionsUi.presets || !optionsUi.nfer || !optionsUi.geo || !optionsUi.hunt || !optionsUi.alerts || !optionsUi.mute || !optionsUi.throttle || !optionsUi.keymap) {
  fail.push('options toggles missing');
}
if (errs.length) fail.push('page errors ' + errs.slice(0, 2).join('|'));

out.fail = fail;
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync('res-feat1110.json', JSON.stringify(out, null, 1));
await p.screenshot({ path: 'shot-feat1110.png' }).catch(() => {});
await ctx.close();
if (fail.length) {
  console.error('FEATURES SMOKE FAIL', fail);
  process.exit(1);
}
console.log('FEATURES SMOKE OK');
