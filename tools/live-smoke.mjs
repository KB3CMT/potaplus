import { chromium } from 'playwright-core';
import fs from 'fs';
const ext = process.argv[2], tag = process.argv[3]||'t';
const ud = `/tmp/pp-prof-${tag}`; fs.rmSync(ud,{recursive:true,force:true});
const ctx = await chromium.launchPersistentContext(ud,{executablePath:'/workspace/potaplus-refactor/browsers/chrome-linux64/chrome',headless:true,
  args:['--headless=new',`--disable-extensions-except=${ext}`,`--load-extension=${ext}`,'--no-sandbox','--disable-gpu','--disable-dev-shm-usage'],ignoreDefaultArgs:['--disable-extensions'],viewport:{width:1400,height:900}});
let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker',{timeout:15000});
const swErr=[]; sw.on?.('console',m=>{ if(m.type()==='error') swErr.push(m.text())});
// enable all display features
await sw.evaluate(async()=>{ const o={}; for (const k of ['enableMyAwards','enableNeededParks','enableNeededWAS','enableNeededLocations','enableNeededN1CC','enableNeededOps','enableSpotFilters','enableUTCClock','enableSpaceWX','enableWidget_RigRef','enableOpProfileInfo','enableBandEdgeWarnings','enableIconQRZ','enableIconRBN','enableIconPSKReporter','enableHideSpotterCall','enableHideSpotterComment','enableSpotTimeAbbrv','enableFilterLabelTimeAbbrv','enableLogDisplay']) o[k]=true;
  await new Promise(r=>setTimeout(r,1500)); const cur = await chrome.storage.local.get('options'); const opts={...(cur.options||{}),...o, enableQsy:true, enableLogging:true,
   qsyConfig:{...((cur.options||{}).qsyConfig||{}), method:'omnirig', proto:'http', host:'127.0.0.1', port:'8073'},
   loggingConfig:{...((cur.options||{}).loggingConfig||{}), method:'log4om', proto:'http', host:'127.0.0.1', port:'8073'}};
  await chrome.storage.local.set({options:opts}); return Object.keys(opts).length;}).then(k=>console.log('storage keys before',k)).catch(e=>console.log('sw eval err',e.message));
const out={};
for (const [u,label] of [['https://pota.app/','spots'],['https://pota.app/#/','hashspots'],['https://pota.app/activations','activations'],['https://pota.app/profile/K2DW','profile'],['https://next.pota.app/','next']]) {
  const p = await ctx.newPage(); const logs=[];
  p.on('console',m=>{const t=m.text(); if(m.type()==='error'||/potaplus|MYCALL|Uncaught|TypeError/i.test(t)) logs.push(m.type()+': '+t.slice(0,250));});
  p.on('pageerror',e=>logs.push('pageerror: '+String(e).slice(0,250)));
  await p.goto(u,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(22000);
  const info = await p.evaluate(()=>{ const q=s=>document.querySelectorAll(s).length;
    return { url:location.href, toolbar:!!document.getElementById('potaplus_toolbar'), widgets:!!document.getElementById('potaplus_widgets'), ver:document.getElementById('label_ver')?.innerText,
      spacewx:document.getElementById('spacewx_container')?.innerText, clock:document.getElementById('utc_clock')?.innerText||null,
      ppEls:q('[id^=potaplus],[class*=potaplus]'), qsl:q('[data-marker=QSL_BTN]'), qsy:q('input#btn_qsy'), qrz:q('[data-marker=QRZ_LINK]'), rbn:q('[data-marker=RBN_LINK],[data-marker=PSKR_LINK]'), needBadges:q('[data-marker=PARKS_HUNTED],[data-marker=N1CC_HUNTED]'), regionFilter:document.getElementById('filter_container')?.innerText.slice(0,200), timeLabels:q('#time_label'), icons:q('img[src*="chrome-extension"]'),
      dupToolbars:q('#potaplus_toolbar'), banner: document.body.innerText.includes('PLEASE SIGN IN'), rows:q('tr[data-spot-activator]'), allIds:[...new Set([...document.querySelectorAll('[id]')].map(e=>e.id).filter(i=>!/^(v-|input-|app)/.test(i)))].slice(0,60)}});
  await p.screenshot({path:`shot-${tag}-${label}.png`});
  out[label]={info,logs:logs.slice(0,25)}; await p.close();
}
out.swErr=swErr; console.log(JSON.stringify(out,null,1)); fs.writeFileSync(`res-${tag}.json`,JSON.stringify(out,null,1));
await ctx.close();
