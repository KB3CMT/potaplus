import { chromium } from 'playwright-core';
import fs from 'fs';

const chrome =
  process.env.CHROME ||
  '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome';
const ext = process.cwd();
const ud = '/tmp/pp-card';
fs.rmSync(ud, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(ud, {
  executablePath: chrome,
  headless: true,
  args: [
    '--headless=new',
    `--disable-extensions-except=${ext}`,
    `--load-extension=${ext}`,
    '--no-sandbox',
    '--disable-gpu',
  ],
  ignoreDefaultArgs: ['--disable-extensions'],
  viewport: { width: 1400, height: 900 },
});
const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 25000 }));
await new Promise((r) => setTimeout(r, 800));
await sw.evaluate(async () => {
  const c = (await chrome.storage.local.get('options')).options || {};
  c.enableLogging = true;
  c.enableQsy = true;
  c.enableSpotFilters = true;
  c.enableIconQRZ = true;
  c.loggingConfig = { ...(c.loggingConfig || {}), method: 'log4om', proto: 'http', host: '127.0.0.1', port: '8073' };
  c.qsyConfig = { ...(c.qsyConfig || {}), method: 'omnirig', proto: 'http', host: '127.0.0.1', port: '8073' };
  await chrome.storage.local.set({ options: c });
});
const p = await ctx.newPage();
const logs = [];
p.on('pageerror', (e) => logs.push(String(e)));
await p.goto('https://pota.app/', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('tr[data-spot-activator], [ext-actv]', { timeout: 40000 });

const picker = await p.evaluate(() => {
  const nodes = [...document.querySelectorAll('select, [role="combobox"], .v-select, .v-field')];
  return nodes.slice(0, 20).map((el) => ({
    tag: el.tagName,
    role: el.getAttribute('role'),
    cls: (el.className || '').toString().slice(0, 80),
    aria: el.getAttribute('aria-label'),
    text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 80),
    values: el.tagName === 'SELECT' ? [...el.options].map((o) => o.value + ':' + o.text).slice(0, 8) : [],
  }));
});
console.log('pickers', JSON.stringify(picker, null, 1));

const clicked = await p.evaluate(() => {
  const labels = [...document.querySelectorAll('label, .v-label, span, div')].filter(
    (el) => /^(View|Views)$/i.test((el.textContent || '').trim()) && (el.textContent || '').trim().length < 10
  );
  return labels.map((el) => ({
    tag: el.tagName,
    text: el.textContent.trim(),
    for: el.getAttribute('for'),
    near: (el.parentElement && el.parentElement.innerText || '').replace(/\s+/g, ' ').slice(0, 120),
  }));
});
console.log('view labels', JSON.stringify(clicked, null, 1));

// Try native select with card option specifically
const viaSelect = await p.evaluate(() => {
  const sel = [...document.querySelectorAll('select')].find((el) =>
    [...el.options].some((o) => o.value === 'card')
  );
  if (!sel) return false;
  sel.value = 'card';
  sel.dispatchEvent(new Event('input', { bubbles: true }));
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
});
console.log('viaSelect', viaSelect);
await p.waitForTimeout(2000);

if ((await p.locator('.spot-card').count()) === 0) {
  // Vuetify select: click the control next to "View"
  const viewCtl = p.locator('text=View').first();
  try {
    await viewCtl.click({ timeout: 3000 });
    await p.waitForTimeout(400);
    await p.getByText('Card', { exact: true }).last().click({ timeout: 4000 });
  } catch (e) {
    console.log('click View failed', e.message);
  }
  await p.waitForTimeout(3000);
}

if ((await p.locator('.spot-card').count()) === 0) {
  // Pinia store if present
  const viaPinia = await p.evaluate(() => {
    const app = document.querySelector('#app') && document.querySelector('#app').__vue_app__;
    const pinia = app && app.config && app.config.globalProperties && app.config.globalProperties.$pinia;
    const stores = [];
    try {
      if (pinia && pinia._s) {
        pinia._s.forEach((s, name) => {
          stores.push(name);
          if (s.viewMode != null) s.viewMode = 'card';
          if (s.$state && s.$state.viewMode != null) s.$state.viewMode = 'card';
          if (typeof s.setViewMode === 'function') s.setViewMode('card');
        });
      }
    } catch (e) {
      return { err: String(e), stores };
    }
    return { stores };
  });
  console.log('viaPinia', JSON.stringify(viaPinia));
  await p.waitForTimeout(3000);
}

const info = await p.evaluate(() => {
  const q = (s) => document.querySelectorAll(s).length;
  const card = document.querySelector('.spot-card, [data-spot-activator].v-col, [ext-spot].v-col');
  return {
    cards: q('.spot-card'),
    hosts: q('[data-spot-activator]'),
    qsy: q('.spot-card input.potaplus-qsy, [data-spot-activator] input.potaplus-qsy, input#btn_qsy'),
    qsl: q('.spot-card [data-marker=QSL_BTN], [data-spot-activator] [data-marker=QSL_BTN]'),
    qrz: q('.spot-card [data-marker=QRZ_LINK], [data-spot-activator] [data-marker=QRZ_LINK]'),
    hide: q('button[aria-label*="Hide this spot" i]'),
    hookOnCard: !!(card && (card.getAttribute('ext-actv') || (card.closest('[ext-actv]') && card.closest('[ext-actv]').getAttribute('ext-actv')))),
    sample: card ? card.outerHTML.slice(0, 400) : null,
    viewText: (document.body.innerText.match(/View[\s\S]{0,40}/) || [''])[0],
  };
});
await p.screenshot({ path: 'shot-card-view.png' });
console.log('card info', JSON.stringify(info, null, 1));
console.log('errors', logs);
await ctx.close();
if (!info.cards && !info.qsy) process.exit(1);
if (info.cards && !info.qsy) process.exit(1);
console.log('CARD SMOKE OK');
