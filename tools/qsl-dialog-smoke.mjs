import { chromium } from 'playwright-core';
import fs from 'fs';
const chrome =
  process.env.CHROME ||
  [
    '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    '/workspace/potaplus-refactor/browsers/chrome-linux64/chrome',
    '/usr/bin/google-chrome',
    '/usr/local/bin/google-chrome',
  ].find((p) => fs.existsSync(p));
const ext = '' + (process.env.EXT || process.cwd()) + '';
const ud = '/tmp/pp-qsl';
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
  ],
  ignoreDefaultArgs: ['--disable-extensions'],
  viewport: { width: 1400, height: 900 },
});
const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
await new Promise((r) => setTimeout(r, 1500));
await sw.evaluate(async () => {
  const c = (await chrome.storage.local.get('options')).options || {};
  c.enableLogging = true;
  c.enableQsy = true;
  c.loggingConfig = { ...(c.loggingConfig || {}), method: 'log4om', proto: 'http', host: '127.0.0.1', port: '8073' };
  c.qsyConfig = { ...(c.qsyConfig || {}), method: 'omnirig', proto: 'http', host: '127.0.0.1', port: '8073' };
  await chrome.storage.local.set({ options: c });
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(String(e)));
const reqs = [];
p.on('request', (r) => {
  if (/127\.0\.0\.1|api\.pota\.app\/spot$/.test(r.url())) reqs.push(r.method() + ' ' + r.url().slice(0, 160));
});
await p.goto('https://pota.app/', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('[data-marker=QSL_BTN]', { timeout: 40000 });
await p.click('input#btn_qsy, input.potaplus-qsy');
await p.waitForTimeout(800);
await p.click('[data-marker=QSL_BTN]');
await p.waitForTimeout(1500);
const d = await p.evaluate(() => {
  const dlg = document.querySelector('[data-potaplus-log-dialog]');
  return dlg
    ? {
        visible: dlg.offsetParent !== null || getComputedStyle(dlg).display !== 'none',
        text: dlg.innerText.replace(/\s+/g, ' ').slice(0, 300),
        btns: [...dlg.querySelectorAll('input[type=button],button')].map((b) => b.value || b.innerText),
      }
    : null;
});
console.log('dialog', JSON.stringify(d));
await p.screenshot({ path: 'shot-qsl-dialog.png' });
const logBtn = await p.$('[data-potaplus-log-dialog] input[value^="Log "], [data-potaplus-log-dialog] button:has-text("Log ")');
if (logBtn) {
  await logBtn.click();
  await p.waitForTimeout(1500);
}
console.log('requests', JSON.stringify(reqs));
console.log('errors', JSON.stringify(errs));
console.log(
  'dialog after Log',
  await p.evaluate(() => {
    const dlg = document.querySelector('[data-potaplus-log-dialog]');
    return dlg ? getComputedStyle(dlg).display : 'gone';
  })
);
await ctx.close();
if (!d || !d.visible) process.exit(1);
