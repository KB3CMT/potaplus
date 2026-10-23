import { chromium } from 'playwright-core';
import fs from 'fs';
import { execSync } from 'child_process';

const ext = process.argv[2] || process.cwd();
const tag = process.argv[3] || 't';
const chrome =
  process.env.CHROME ||
  [
    '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    '/workspace/potaplus-refactor/browsers/chrome-linux64/chrome',
    '/usr/bin/google-chrome',
    '/usr/local/bin/google-chrome',
  ].find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('No Chrome binary found');
  process.exit(2);
}

function curlHead(url) {
  try {
    return execSync(`curl -sI -o /tmp/pp-head.txt -w '%{http_code} %{url_effective}' --max-redirs 5 -L '${url}'`, {
      encoding: 'utf8',
    }).trim();
  } catch (e) {
    return 'err ' + e.message;
  }
}

const nextStatus = execSync(`curl -sI --max-redirs 0 'https://next.pota.app/' | head -n 20`, { encoding: 'utf8' });
const wwwStatus = (() => {
  try {
    return execSync(`curl -sI --max-redirs 0 'https://www.pota.app/'`, { encoding: 'utf8' });
  } catch (e) {
    return String(e.stderr || e.message || e);
  }
})();

const ud = `/tmp/pp-prof-${tag}`;
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
if (!sw) {
  throw new Error('extension service worker did not start; Chrome may be blocking --load-extension');
}
const swErr = [];
sw.on?.('console', (m) => {
  if (m.type() === 'error') swErr.push(m.text());
});
await sw
  .evaluate(async () => {
    const o = {};
    for (const k of [
      'enableMyAwards',
      'enableNeededParks',
      'enableNeededWAS',
      'enableNeededLocations',
      'enableSpotFilters',
      'enableUTCClock',
      'enableSpaceWX',
      'enableWidget_RigRef',
      'enableOpProfileInfo',
      'enableBandEdgeWarnings',
      'enableIconQRZ',
      'enableLogDisplay',
    ])
      o[k] = true;
    await new Promise((r) => setTimeout(r, 800));
    const cur = await chrome.storage.local.get('options');
    const opts = {
      ...(cur.options || {}),
      ...o,
      enableQsy: true,
      enableLogging: true,
      qsyConfig: { ...((cur.options || {}).qsyConfig || {}), method: 'omnirig', proto: 'http', host: '127.0.0.1', port: '8073' },
      loggingConfig: { ...((cur.options || {}).loggingConfig || {}), method: 'log4om', proto: 'http', host: '127.0.0.1', port: '8073' },
    };
    await chrome.storage.local.set({ options: opts });
    return Object.keys(opts).length;
  })
  .then((k) => console.log('storage keys before', k))
  .catch((e) => console.log('sw eval err', e.message));

async function dumpPage(url, label, extra) {
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || /potaplus|MYCALL|Uncaught|TypeError/i.test(t)) logs.push(m.type() + ': ' + t.slice(0, 250));
  });
  p.on('pageerror', (e) => logs.push('pageerror: ' + String(e).slice(0, 250)));
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(18000);
  if (extra) await extra(p);
  const info = await p.evaluate(() => {
    const q = (s) => document.querySelectorAll(s).length;
    const row = document.querySelector('tr[data-spot-activator], [data-spot-activator]');
    const hooks = row
      ? {
          extSpot: row.hasAttribute('ext-spot'),
          actv: row.getAttribute('ext-actv'),
          ref: row.getAttribute('ext-ref'),
          freq: row.getAttribute('ext-freq'),
          mode: row.getAttribute('ext-mode'),
          band: row.getAttribute('ext-band'),
          slots: [...row.querySelectorAll('[ext-slot]')].map((el) => el.getAttribute('ext-slot')),
        }
      : null;
    return {
      url: location.href,
      toolbar: !!document.getElementById('potaplus_toolbar'),
      widgets: !!document.getElementById('potaplus_widgets'),
      ver: document.getElementById('label_ver')?.innerText,
      spacewx: document.getElementById('spacewx_container')?.innerText,
      clock: document.getElementById('utc_clock')?.innerText || null,
      ppEls: q('[id^=potaplus],[class*=potaplus]'),
      qsl: q('[data-marker=QSL_BTN]'),
      qsy: q('input#btn_qsy, input.potaplus-qsy'),
      qrz: q('[data-marker=QRZ_LINK]'),
      rbn: q('[data-marker=RBN_LINK],[data-marker=PSKR_LINK]'),
      needBadges: q('[data-marker=PARKS_HUNTED],[data-marker=N1CC_HUNTED]'),
      locationBadges: q('[data-marker=LOCATIONS_HUNTED],[data-marker=WAS_HUNTED]'),
      regionFilter: document.getElementById('filter_container')?.innerText.slice(0, 200),
      hideButtons: q('button[aria-label*="Hide this spot" i]'),
      hiddenFilter: /Hidden/i.test(document.body.innerText),
      view: document.querySelector('select option:checked')?.value || null,
      cards: q('.spot-card'),
      rows: q('tr[data-spot-activator], [data-spot-activator]'),
      hookHosts: q('[ext-actv]'),
      banner: document.body.innerText.includes('PLEASE SIGN IN'),
      hooks,
      dupToolbars: q('#potaplus_toolbar'),
    };
  });
  await p.screenshot({ path: `shot-${tag}-${label}.png` }).catch(() => {});
  await p.close();
  return { info, logs: logs.slice(0, 25) };
}

const out = {
  nextHeaders: nextStatus.slice(0, 400),
  www: wwwStatus.slice(0, 200),
  nextFollow: curlHead('https://next.pota.app/'),
};

out.spots = await dumpPage('https://pota.app/', 'spots');
out.hashspots = await dumpPage('https://pota.app/#/', 'hashspots');
out.card = await dumpPage('https://pota.app/', 'card', async (p) => {
  const changed = await p.evaluate(() => {
    const sel = [...document.querySelectorAll('select')].find((el) =>
      [...el.options].some((o) => o.value === 'card')
    );
    if (sel) {
      sel.value = 'card';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      return 'select';
    }
    return '';
  });
  if (!changed) {
    await p.evaluate(() => {
      const app = document.querySelector('#app') && document.querySelector('#app').__vue_app__;
      const pinia = app && app.config && app.config.globalProperties && app.config.globalProperties.$pinia;
      try {
        if (pinia && pinia._s) {
          const spots = pinia._s.get && pinia._s.get('spots');
          if (spots) {
            if (spots.viewMode != null) spots.viewMode = 'card';
            if (spots.$state && spots.$state.viewMode != null) spots.$state.viewMode = 'card';
            if (typeof spots.setViewMode === 'function') spots.setViewMode('card');
          }
        }
      } catch (e) {}
    });
  }
  await p.waitForTimeout(4000);
});
out.activations = await dumpPage('https://pota.app/activations', 'activations');
out.profile = await dumpPage('https://pota.app/profile/K2DW', 'profile');
out.next = await dumpPage('https://next.pota.app/', 'next');
out.swErr = swErr;

const fail = [];
if (!/HTTP\/2 200/.test(out.nextHeaders) || /location:\s*https:\/\/pota\.app/i.test(out.nextHeaders)) {
  fail.push('next.pota.app should still 200 without redirecting to pota.app');
}
if (!out.spots.info.toolbar) fail.push('spots missing toolbar');
if (out.spots.info.ver && !/1\.10\.1/.test(out.spots.info.ver)) fail.push('version label ' + out.spots.info.ver);
if (!out.spots.info.qsy) fail.push('table missing QSY');
if (!out.spots.info.qsl) fail.push('table missing QSL');
if (!out.spots.info.hooks || !out.spots.info.hooks.actv) fail.push('table hooks missing');
if (!out.spots.info.hideButtons) fail.push('site Hide buttons missing (signed out)');
if (out.spots.info.rbn) fail.push('extension still injecting RBN icons');
if (out.activations.info.toolbar) fail.push('activations should not have spots toolbar');
if (out.profile.info.toolbar) fail.push('profile should not have spots toolbar');
if (!out.card.info.qsy && !out.card.info.cards) fail.push('card view did not render cards or QSY');
if (out.card.info.cards && !out.card.info.qsy) fail.push('card view rendered but no QSY');
const typeErrs = []
  .concat(out.spots.logs, out.card.logs, out.activations.logs, out.profile.logs)
  .filter((l) => /TypeError|Uncaught/i.test(l));
if (typeErrs.length) fail.push('page errors: ' + typeErrs.slice(0, 3).join(' | '));

out.fail = fail;
console.log(JSON.stringify(out, null, 1));
fs.writeFileSync(`res-${tag}.json`, JSON.stringify(out, null, 1));
await ctx.close();
if (fail.length) {
  console.error('SMOKE FAIL', fail);
  process.exit(1);
}
console.log('SMOKE OK');
