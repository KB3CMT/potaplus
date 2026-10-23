
//const cloneItems = (items) => items.map(item => Array.isArray(item) ? cloneItems(item) : item);

function sendChromeMessage( message, payload ){
  chrome.runtime.sendMessage(
	  { "message": message, "payload": payload },
	  response => {
		  if( chrome.runtime.lastError ){
			return;
		  }
		  if( ! response ){
			return;
		  }
		  if(response.message === 'success'){
			  // do nothing
		  }else{
			console.log(`ERROR sendMessage '${message}'`, response);
			console.log( 'ERROR sendMessage()', message, response.message, response.error && response.error.message );
		  }
	  }
  );
}

function parseCookie(str){
  if( ! str ){
    return {};
  }
  return str
    .split(';')
    .reduce((acc, pair) => {
      try {
        var i = pair.indexOf('=');
        var k = (i === -1 ? pair : pair.slice(0, i)).trim();
        var raw = (i === -1 ? '' : pair.slice(i + 1)).trim();
        if( ! k ){
          return acc;
        }
        // JWTs use '.' and '=' padding; URI-decoding can throw on '%' in the payload
        // and would drop the cookie, leaving award APIs as "Not authorized".
        if( raw.split('.').length === 3 && raw.length > 40 ){
          acc[k] = raw;
        } else {
          acc[decodeURIComponent(k)] = decodeURIComponent(raw);
        }
      } catch (e) {
        // skip malformed cookie pairs
      }
      return acc;
    }, {});
}

function isPotaHost(){
  var h = location.hostname || '';
  return h === 'pota.app' || h === 'www.pota.app' || h === 'next.pota.app';
}

function getPotaPath(){
  // pota.app (Oct 2026) uses history routes only; legacy #/ links redirect to the path form.
  return location.pathname || '/';
}

function getPotaRoute(){
  var path = getPotaPath();
  if( path === '/' || path === '' ){
    return 'spots';
  }
  if( /^\/activations/.test(path) ){
    return 'activations';
  }
  if( /^\/profile\//.test(path) ){
    return 'profile';
  }
  if( /^\/user(\/|$)/.test(path) || /^\/awards(\/|$)/.test(path) ){
    return 'user';
  }
  if( /^\/park\//.test(path) ){
    return 'park';
  }
  return 'other';
}

function potaAppUrl(path){
  if( path.charAt(0) !== '/' ){
    path = '/' + path;
  }
  return (isPotaHost() ? location.origin : 'https://pota.app') + path;
}

function getPotaApiOrigin(){
  return location.origin || 'https://pota.app';
}

function getPotaApiOpts(token){
  var headers = {
    accept: "application/json, text/plain, */*"
  };
  if( token ){
    headers.authorization = token;
  }
  return { headers: headers };
}

function unwrapStoredValue(val){
  if( val == null ){
    return null;
  }
  if( typeof val !== 'string' ){
    if( typeof val === 'object' ){
      return val.idToken || val.jwtToken || val.token || null;
    }
    return val;
  }
  var s = val.trim();
  if( ! s ){
    return null;
  }
  if( (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"')
      || (s.charAt(0) === "'" && s.charAt(s.length - 1) === "'") ){
    try {
      s = JSON.parse(s);
    } catch (e) {
      s = s.slice(1, -1);
    }
  }
  if( typeof s === 'object' && s ){
    return s.idToken || s.jwtToken || s.token || null;
  }
  if( typeof s === 'string' && s.charAt(0) === '{' ){
    try {
      var o = JSON.parse(s);
      if( o && typeof o === 'object' ){
        return o.idToken || o.jwtToken || o.token || s;
      }
    } catch (e) {}
  }
  return s;
}

function isJwtLike(s){
  return typeof s === 'string' && s.split('.').length === 3 && s.length > 40;
}

function decodeJwtPayload(token){
  try {
    var parts = String(token || '').split('.');
    if( parts.length < 2 ){
      return null;
    }
    var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while( b64.length % 4 ){
      b64 += '=';
    }
    return JSON.parse(atob(b64));
  } catch (e) {
    return null;
  }
}

function looksLikeCallsign(c){
  if( ! c ){
    return false;
  }
  return /^[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,5}(\/[A-Z0-9]+)?$/i.test(String(c).trim());
}

function callsignFromJwt(token){
  var p = decodeJwtPayload(token);
  if( ! p ){
    return '';
  }
  var c = p['pota:callsign'] || p.callsign || '';
  if( looksLikeCallsign(c) ){
    return String(c).toUpperCase();
  }
  return '';
}

function findTokenInMap(store){
  if( ! store ){
    return null;
  }
  var keys;
  try {
    keys = Object.keys(store);
  } catch (e) {
    return null;
  }
  var i;
  var key;
  var val;
  for( i = 0; i < keys.length; i++ ){
    key = keys[i];
    if( /idToken$/i.test(key) || /CognitoIdentityServiceProvider\..+\.idToken/i.test(key) ){
      val = unwrapStoredValue(store[key]);
      if( isJwtLike(val) ){
        return val;
      }
    }
  }
  for( i = 0; i < keys.length; i++ ){
    key = keys[i];
    if( /idToken|IdToken|id_token/i.test(key) ){
      val = unwrapStoredValue(store[key]);
      if( isJwtLike(val) ){
        return val;
      }
    }
  }
  return null;
}

function findStorageToken(store){
  return findTokenInMap(store);
}

function readBridgeAuth(){
  try {
    var raw = sessionStorage.getItem('POTAPLUS_AUTH');
    if( ! raw ){
      return null;
    }
    var o = JSON.parse(raw);
    if( ! o || typeof o !== 'object' ){
      return null;
    }
    return o;
  } catch (e) {
    return null;
  }
}

function getPOTASettings(){
  var c = {};
  try {
    c = parseCookie(document.cookie);
  } catch (e) {
    c = {};
  }
  var tokenKey = Object.keys(c).find(x => /idToken$/i.test(x) || /CognitoIdentityServiceProvider\..+\.idToken/i.test(x) );
  var TOKEN = tokenKey ? unwrapStoredValue(c[tokenKey]) : null;
  if( ! isJwtLike(TOKEN) ){
    TOKEN = findTokenInMap(c) || findTokenInMap(window.localStorage) || findTokenInMap(window.sessionStorage);
  }
  var bridge = readBridgeAuth();
  if( ! isJwtLike(TOKEN) && bridge && isJwtLike(bridge.token) ){
    TOKEN = bridge.token;
  }
  if( ! isJwtLike(TOKEN) ){
    TOKEN = null;
    console.log("POTA api token not found");
  }
  var potaSettings = {};
  try {
    potaSettings = JSON.parse(c.POTA_SETTINGS || '{}') || {};
  } catch (e) {
    potaSettings = {};
  }
  if( typeof potaSettings !== 'object' || potaSettings === null ){
    potaSettings = {};
  }
  // next.pota.app renamed tableView -> viewMode and stores bandFilter as an array.
  if( potaSettings.viewMode && typeof potaSettings.tableView === 'undefined' ){
    potaSettings.tableView = potaSettings.viewMode === 'table';
  }
  if( Array.isArray(potaSettings.bandFilter) ){
    potaSettings.bandFilter = potaSettings.bandFilter.length ? potaSettings.bandFilter : 'All';
  }
  potaSettings.darkMode = !!potaSettings.darkMode;
  var callsign = (potaSettings.callsign || '').toString().trim();
  if( ! looksLikeCallsign(callsign) && TOKEN ){
    callsign = callsignFromJwt(TOKEN);
  }
  if( ! looksLikeCallsign(callsign) && bridge && looksLikeCallsign(bridge.callsign) ){
    callsign = String(bridge.callsign).trim().toUpperCase();
  }
  potaSettings.callsign = looksLikeCallsign(callsign) ? callsign.toUpperCase() : (callsign || '');
  potaSettings.tokenKey = tokenKey;
  return { "apiToken": TOKEN, "potaSettings": potaSettings };
}

function showPotaSignInBanner(){
  var signinLabel = document.querySelector('#label_update');
  if( signinLabel ){
    signinLabel.innerHTML = 'PLEASE SIGN IN TO POTA.APP ACCOUNT';
    signinLabel.style.display = '';
  }
}

function hidePotaSignInBanner(){
  var signinLabel = document.querySelector('#label_update');
  if( signinLabel && /PLEASE SIGN IN/i.test(signinLabel.innerHTML || '') ){
    signinLabel.style.display = 'none';
    signinLabel.innerHTML = 'UPDATE';
  }
}

function whenPotaSessionReady(onReady, onFail, timeoutMs){
  var done = false;
  var iv;
  function finishOk(s){
    if( done ){
      return;
    }
    if( ! s || ! looksLikeCallsign(s.potaSettings && s.potaSettings.callsign) ){
      return;
    }
    // Callsign can be in POTA_SETTINGS before the JWT is readable. Award
    // endpoints need the token; keep polling until it shows up.
    if( ! isJwtLike(s.apiToken) ){
      return;
    }
    done = true;
    if( iv ){
      clearInterval(iv);
    }
    onReady(s);
  }
  function tick(){
    finishOk(getPOTASettings());
  }
  try {
    window.addEventListener('message', function(ev){
      if( ev.origin && location.origin && ev.origin !== location.origin ){
        return;
      }
      var data = ev && ev.data;
      if( ! data || data.source !== 'potaplus' || data.type !== 'AUTH' ){
        return;
      }
      try {
        if( data.callsign || data.token ){
          sessionStorage.setItem('POTAPLUS_AUTH', JSON.stringify({
            callsign: data.callsign || '',
            token: data.token || '',
            t: Date.now()
          }));
        }
      } catch (e) {}
      tick();
    });
  } catch (e) {}
  tick();
  if( done ){
    return;
  }
  var started = Date.now();
  iv = setInterval(function(){
    tick();
    if( done ){
      return;
    }
    if( Date.now() - started > (timeoutMs || 15000) ){
      clearInterval(iv);
      if( ! done ){
        done = true;
        if( onFail ){
          onFail(getPOTASettings());
        }
      }
    }
  }, 250);
}

function isPotaDarkMode(){
  return !!(
    document.querySelector('.v-theme--dark')
    || document.documentElement.classList.contains('v-theme--dark')
    || (document.body && document.body.classList.contains('v-theme--dark'))
  );
}

function qsFirst(selectors){
  for( var i = 0; i < selectors.length; i++ ){
    var el = document.querySelector(selectors[i]);
    if( el ){
      return el;
    }
  }
  return null;
}

function closestAwardEarnedTable(el){
  return !!(el && el.closest && (
    el.closest('.earned-table')
    || el.closest('.award-list-item')
    || el.closest('[class*="UserAwards"]')
  ));
}

function hidePotaPlusPageChrome(){
  var ids = ['potaplus_toolbar', 'potaplus_widgets', 'scan_container'];
  ids.forEach(function(id){
    var n = document.getElementById(id);
    if( n ){ n.style.display = 'none'; }
  });
}

function showPotaPlusPageChrome(){
  var tb = document.getElementById('potaplus_toolbar');
  var w = document.getElementById('potaplus_widgets');
  if( tb ){ tb.style.display = ''; }
  if( w ){ w.style.display = ''; }
}

function asArray(val){
  return Array.isArray(val) ? val : [];
}

function findInList(list, pred){
  if( ! Array.isArray(list) ){
    return undefined;
  }
  return list.find(pred);
}

function spotHookRoot(el){
  if( ! el ){
    return null;
  }
  if( el.getAttribute && (el.getAttribute('ext-actv') || el.getAttribute('ext-ref') || el.hasAttribute('ext-spot')) ){
    return el;
  }
  return (el.closest && (el.closest('[ext-spot], [ext-actv], [data-spot-activator]'))) || el;
}

function extHook(root, name){
  var el = spotHookRoot(root);
  if( ! el || ! el.getAttribute ){
    return '';
  }
  return el.getAttribute('ext-' + name) || '';
}

function extSlot(root, name){
  if( ! root || ! root.querySelector ){
    return null;
  }
  return root.querySelector('[ext-slot="' + name + '"]');
}

function fillExtSlot(root, name, node){
  var slot = extSlot(root, name);
  if( ! slot ){
    return false;
  }
  slot.appendChild(node);
  return true;
}

function parseRegionFromText(text, parkRef){
  var src = String(text || '');
  var ref = String(parkRef || '').toUpperCase();
  var re = /\b([A-Z]{1,3}-[A-Z0-9]{2,})\b/gi;
  var m;
  var found = [];
  while( (m = re.exec(src)) ){
    var tok = m[1].toUpperCase();
    if( tok === ref ){
      continue;
    }
    if( /-\d{3,}/.test(tok) ){
      continue;
    }
    found.push(tok);
  }
  return found[0] || '';
}

function debounceFn(fn, wait){
  var t = 0;
  return function(){
    var ctx = this;
    var args = arguments;
    if( t ){
      clearTimeout(t);
    }
    t = setTimeout(function(){
      t = 0;
      fn.apply(ctx, args);
    }, wait || 80);
  };
}

function isPotaPlusChromeNode(n){
  if( ! n ){
    return false;
  }
  if( n.nodeType === 3 ){
    n = n.parentElement;
  }
  if( ! n || n.nodeType !== 1 ){
    return false;
  }
  if( n.getAttribute && n.getAttribute('data-marker') ){
    return true;
  }
  if( n.id && /^potaplus_|^filter_container$|^scan_container$|^spacewx_container$|^myawards_container$/.test(n.id) ){
    return true;
  }
  return !!(n.closest && n.closest('#potaplus_toolbar, #potaplus_widgets, #potaplus_log_dialog, [data-potaplus-log-dialog], [data-marker]'));
}

function mutationsAffectSpots(mutations){
  if( ! mutations || ! mutations.length ){
    return true;
  }
  var i, j, m, nodes, n;
  for( i = 0; i < mutations.length; i++ ){
    m = mutations[i];
    if( m.type && m.type !== 'childList' ){
      continue;
    }
    nodes = [];
    if( m.addedNodes ){
      for( j = 0; j < m.addedNodes.length; j++ ){ nodes.push(m.addedNodes[j]); }
    }
    if( m.removedNodes ){
      for( j = 0; j < m.removedNodes.length; j++ ){ nodes.push(m.removedNodes[j]); }
    }
    for( j = 0; j < nodes.length; j++ ){
      n = nodes[j];
      if( ! n || n.nodeType !== 1 ){
        continue;
      }
      if( isPotaPlusChromeNode(n) ){
        continue;
      }
      if( n.matches && (n.matches('tr, .v-card, .v-col, [data-spot-activator], .spot-card, [ext-spot]') || (n.querySelector && n.querySelector('tr, [data-spot-activator], .spot-card, [ext-spot]'))) ){
        return true;
      }
    }
    if( m.target && m.target.closest && m.target.closest('tr, [data-spot-activator], .spot-card, [ext-spot], tbody, .v-row') && ! isPotaPlusChromeNode(m.target) ){
      return true;
    }
  }
  return false;
}

function observeRootForPota(){
  return document.querySelector('main') || document.querySelector('#app') || document.body;
}

function pokeMainTable(){
  try {
    window.dispatchEvent(new Event('potaplus-paint'));
  } catch (e) {}
}

function asUserList(data){
  if( isPotaAuthError(data) ){ return null; }
  if( Array.isArray(data) ){
    return isPoisonedEarnedList(data) ? null : data;
  }
  if( data && Array.isArray(data.items) ){ return data.items; }
  return null;
}

function isPotaAuthError(data){
  if( data == null ){ return false; }
  if( typeof data === 'string' ){
    var s = data.trim().toLowerCase();
    return s === 'not authorized' || s === 'unauthorized' || /not authorized/.test(s);
  }
  if( typeof data === 'object' && ! Array.isArray(data) ){
    var msg = String(data.message || data.error || data.Message || '');
    return /not authorized|unauthorized|missingauthentication/i.test(msg);
  }
  return false;
}

function isPoisonedEarnedList(arr){
  if( ! Array.isArray(arr) || ! arr.length ){ return false; }
  var n = 0;
  for( var i = 0; i < arr.length; i++ ){
    if( typeof arr[i] === 'string' && arr[i].length === 1 ){ n++; }
  }
  return n === arr.length;
}

function normalizeEarnedAward(row){
  if( row == null ){ return null; }
  if( typeof row === 'string' ){
    if( row.length <= 2 ){ return null; }
    try {
      var parsed = JSON.parse(row);
      if( parsed && typeof parsed === 'object' ){ row = parsed; }
      else { return null; }
    } catch (e) {
      return null;
    }
  }
  if( typeof row !== 'object' ){ return null; }
  return row;
}

function formatEarnedAwardLine(row){
  row = normalizeEarnedAward(row);
  if( ! row ){ return ''; }
  var date = row.dateGranted || row.granted || row.date || '';
  if( typeof date === 'string' ){
    date = date.replace(/T.*/, '');
  }
  var bits = [
    date,
    row.awardName || row.name,
    row.badgeNum,
    row.endorsements,
    row.reference,
    row.parkName,
    row.operator,
    row.operatorCallsign,
    row.operatorName,
    row.detail,
    row.radarDate,
    row.additionalDetails,
    row.awardDescription
  ].filter(function(v){ return v !== null && v !== undefined && v !== ''; });
  return bits.join(' | ');
}

function parseEarnedAwardsPayload(data){
  if( isPotaAuthError(data) ){ return []; }
  if( typeof data === 'string' ){
    try { data = JSON.parse(data); } catch (e) { return []; }
  }
  if( ! data ){ return []; }
  var rows = null;
  if( Array.isArray(data) ){ rows = data; }
  else if( Array.isArray(data.items) ){ rows = data.items; }
  else if( Array.isArray(data.awards) ){ rows = data.awards; }
  else if( Array.isArray(data.earned) ){ rows = data.earned; }
  else if( data.data != null ){ return parseEarnedAwardsPayload(data.data); }
  if( ! rows ){ return []; }
  if( isPoisonedEarnedList(rows) ){ return []; }
  return rows.map(normalizeEarnedAward).filter(Boolean);
}

function parseEarnedCachePayload(cache){
  if( ! cache || cache.data == null ){ return {}; }
  try {
    var data = cache.data;
    if( typeof data === 'string' ){
      data = JSON.parse(data);
    }
    if( typeof data === 'string' ){
      data = JSON.parse(data);
    }
    if( ! data || typeof data !== 'object' || Array.isArray(data) ){
      return {};
    }
    if( isPoisonedEarnedList(data.curr) || isPoisonedEarnedList(data.delta) ){
      return {};
    }
    return data;
  } catch (e) {}
  return {};
}

function firstFiniteNumber(obj, keys){
  if( ! obj || typeof obj !== 'object' ){ return null; }
  for( var i = 0; i < keys.length; i++ ){
    var v = obj[keys[i]];
    if( typeof v === 'number' && isFinite(v) ){ return v; }
    if( typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)) ){
      return Number(v);
    }
  }
  return null;
}

function parseAwardProgress(data, currentKeys, nextKeys){
  if( isPotaAuthError(data) ){ return null; }
  if( typeof data === 'string' ){
    try { data = JSON.parse(data); } catch (e) { return null; }
  }
  if( ! data || typeof data !== 'object' || Array.isArray(data) ){ return null; }
  var cur = firstFiniteNumber(data, currentKeys);
  var nxt = firstFiniteNumber(data, nextKeys);
  if( cur == null && data.data ){
    return parseAwardProgress(data.data, currentKeys, nextKeys);
  }
  if( cur == null ){ return null; }
  return { current: cur, next: nxt };
}

function parseActivationsPayload(data){
  if( isPotaAuthError(data) ){ return []; }
  if( Array.isArray(data) ){ return data; }
  if( ! data || typeof data !== 'object' ){ return []; }
  if( Array.isArray(data.activations) ){ return data.activations; }
  if( Array.isArray(data.items) ){ return data.items; }
  if( Array.isArray(data.logbook) ){ return data.logbook; }
  if( data.data != null ){ return parseActivationsPayload(data.data); }
  return [];
}

function cleanN1ccEntry(hunted){
  if( ! hunted || typeof hunted !== 'object' ){
    return { reference: '', name: '', bands: 0, bandsWorked: {}, bandsWorkedStr: '', cacheComplete: false };
  }
  hunted.bandsWorked = hunted.bandsWorked || {};
  hunted.bandsWorkedStr = hunted.bandsWorkedStr || '';
  if( hunted.bandsWorked.hasOwnProperty('INVALID') ){
    delete hunted.bandsWorked.INVALID;
  }
  hunted.bandsWorkedStr = Object.keys(hunted.bandsWorked)
    .sort(function(a,b){ return compareBands(a,b); })
    .join(',');
  hunted.bandsCtCached = Object.keys(hunted.bandsWorked).length;
  Object.keys(hunted.bandsWorked).forEach(function(band){
    if( typeof hunted.bandsWorked[band] === 'object' ){
      hunted.bandsWorked[band] = hunted.bandsWorked[band].qsoId;
    }
  });
  hunted.bandsCtOfficial = hunted.bands;
  hunted.cacheComplete = !!(hunted.bandsCtOfficial && hunted.bandsCtCached == hunted.bandsCtOfficial);
  return hunted;
}

function detectPotaLayout(){
  var result = {
    MAINTABLE: null,
    CARDMODE: false,
    LISTMODE: true,
    DARKMODE: isPotaDarkMode(),
    view: 'unknown'
  };
  var route = getPotaRoute();

  // pota.app table / compact-list rows are tagged. Card view puts the same
  // hooks on the wrapping v-col, not on .spot-card itself.
  var tableRow = document.querySelector('tr[data-spot-activator], tr[ext-spot]');
  if( tableRow ){
    result.MAINTABLE = tableRow.closest('tbody') || tableRow.parentElement;
    result.LISTMODE = true;
    result.CARDMODE = false;
    result.view = tableRow.closest('.spot-list') ? 'list' : 'table';
    result.DARKMODE = isPotaDarkMode();
    return result;
  }
  var cardHost = document.querySelector('[data-spot-activator].v-col, [ext-spot].v-col, .spot-card');
  if( cardHost ){
    result.MAINTABLE = cardHost.closest('.v-row') || cardHost.parentElement;
    result.LISTMODE = false;
    result.CARDMODE = true;
    result.view = 'card';
    result.DARKMODE = isPotaDarkMode();
    return result;
  }

  // Vuetify 3 data table without data-spot-activator yet.
  var v3Table = document.querySelector('.v-table__wrapper table tbody')
    || document.querySelector('.v-data-table table tbody');
  if( v3Table && (route === 'spots' || route === 'activations') && ! closestAwardEarnedTable(v3Table) ){
    result.MAINTABLE = v3Table;
    result.LISTMODE = true;
    result.CARDMODE = false;
    result.view = 'table';
    return result;
  }

  // Activations card grid (narrow screens)
  var v3Row = document.querySelector('main .v-row') || document.querySelector('.v-row');
  if( v3Row && route === 'activations' ){
    result.MAINTABLE = v3Row;
    result.LISTMODE = false;
    result.CARDMODE = true;
    result.view = 'card';
    return result;
  }

  return result;
}

function waitForPotaDom(isReady, cb, timeoutMs){
  if( isReady() ){
    cb();
    return;
  }
  var started = Date.now();
  var iv = setInterval(function(){
    if( isReady() || Date.now() - started > (timeoutMs || 20000) ){
      clearInterval(iv);
      cb();
    }
  }, 250);
}

function watchPotaRoute(handler){
  var last = getPotaRoute();
  var check = function(){
    var now = getPotaRoute();
    if( now !== last ){
      var prev = last;
      last = now;
      handler(now, prev);
    }
  };
  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  try {
    // Wrap history once per page; reinjection must not nest wrappers.
    if( ! history.__potaplusWrapped ){
      history.__potaplusWrapped = true;
      var origPush = history.pushState;
      history.pushState = function(){
        var ret = origPush.apply(this, arguments);
        try { window.dispatchEvent(new Event('potaplus-route')); } catch (e) {}
        return ret;
      };
      var origReplace = history.replaceState;
      history.replaceState = function(){
        var ret = origReplace.apply(this, arguments);
        try { window.dispatchEvent(new Event('potaplus-route')); } catch (e) {}
        return ret;
      };
    }
    window.addEventListener('potaplus-route', check);
  } catch (e) {}
  setInterval(check, 700);
}

function comparePotaPlusVersions(a, b){
  // return <0 if a<b, 0 if equal, >0 if a>b. Non-semver strings compare as strings.
  function parts(v){
    return String(v || '').replace(/^v/i,'').split(/[^0-9]+/).filter(Boolean).map(function(n){ return parseInt(n,10)||0; });
  }
  var aa = parts(a), bb = parts(b);
  var n = Math.max(aa.length, bb.length);
  for( var i = 0; i < n; i++ ){
    var x = aa[i] || 0, y = bb[i] || 0;
    if( x !== y ){ return x - y; }
  }
  return 0;
}

function unsignedHunterPlaceholders(){
  return {
    WAS_HUNTED: [],
    LOCATIONS_HUNTED: [],
    PARKS_HUNTED: [],
    N1CC_HUNTED: [],
    OPS_HUNTED: {},
    MYAWARDS_EARNED: {},
    PROFILE_INFO: {}
  };
}

function seedUnsignedHunterState(){
  // Prefer caller-side assignment; this helper fills any already-declared null globals via window.
  var p = unsignedHunterPlaceholders();
  Object.keys(p).forEach(function(k){
    try {
      if( window[k] == null ){ window[k] = p[k]; }
    } catch (e) {}
  });
}

function headerText(th){
  return ((th && (th.innerText || th.textContent)) || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function mapTableColumns(table, aliases){
  var map = {};
  if( ! table || ! table.tHead || ! table.tHead.rows[0] ){
    return map;
  }
  var cells = table.tHead.rows[0].cells;
  for( var i = 0; i < cells.length; i++ ){
    var text = headerText(cells[i]);
    var aria = ((cells[i].getAttribute('aria-label') || '') + ' ' + (cells[i].querySelector('[aria-label]') ? cells[i].querySelector('[aria-label]').getAttribute('aria-label') : '')).toLowerCase();
    var hay = text + ' ' + aria;
    for( var key in aliases ){
      if( ! aliases.hasOwnProperty(key) ){ continue; }
      if( map.hasOwnProperty(key) ){ continue; }
      var re = aliases[key];
      if( re.test(hay) ){
        map[key] = i;
      }
    }
  }
  return map;
}

var SPOT_COLUMN_ALIASES = {
  spottime: /\b(age|time|ago|heard)\b/,
  call: /\b(activator|callsign|call)\b/,
  freq: /\b(frequency|freq|khz)\b/,
  mode: /\bmode\b/,
  park_num: /\b(reference|ref)\b/,
  park_name: /\b(park|name)\b/,
  park_region: /\b(region|location|loc)\b/,
  spotter: /\bspotter\b/,
  comments: /\bcomment/,
  history: /\bhistory\b/,
  btns: /\b(action|control|re-?spot)/
};

var ACTIVATION_COLUMN_ALIASES = {
  start: /\bstart\b/,
  end: /\bend\b/,
  call: /\bactivator\b/,
  park_num: /\b(park|reference|ref)\b/,
  park_region: /\b(location|region|loc)\b/,
  frequencies: /\bfrequenc/,
  comments: /\bcomment/,
  btns: /\baction/
};

function cellAt(row, idx){
  if( idx === undefined || idx === null || idx < 0 ){
    return null;
  }
  return row.cells && row.cells[idx] ? row.cells[idx] : null;
}

function parseParkReference(text){
  var m = (text || '').match(/\b([A-Z]{1,3}-\d{3,5})\b/i);
  return m ? m[1].toUpperCase() : '';
}

function findRespotButton(root){
  if( ! root ){ return null; }
  var slot = root.querySelector('[ext-slot="btn-spot"]');
  if( slot && slot.parentElement ){
    var near = slot.parentElement.querySelector('button, .v-btn');
    if( near ){ return near; }
  }
  var labeled = Array.from(root.querySelectorAll('button, .v-btn, [role="button"]')).find(function(b){
    var t = (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.innerText || b.textContent || '');
    return /re-?spot|add spot|athspot|herspot|ponovni spot|znovu spot/i.test(t);
  });
  if( labeled ){
    return labeled;
  }
  return root.querySelector('button[aria-label*="Re-Spot" i]')
    || root.querySelector('button[aria-label*="Respot" i]')
    || root.querySelector('button[title*="Re-Spot" i]')
    || root.querySelector('button[title*="Respot" i]')
    || null;
}

function findHistoryButton(root){
  if( ! root ){ return null; }
  return root.querySelector('button[aria-label*="history" i]')
    || Array.from(root.querySelectorAll('button, .v-btn')).find(function(b){
         return /history/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || ''));
       })
    || null;
}

function closestCard(el){
  return el && (el.closest('.spot-card') || el.closest('.v-card'));
}

function cardActions(card){
  if( ! card ){ return null; }
  return card.querySelector('.v-card-actions');
}

function cardTitle(card){
  if( ! card ){ return null; }
  return card.querySelector('.v-card-title');
}

function findActiveDialogForm(){
  var overlays = Array.from(document.querySelectorAll('.v-overlay--active, [role="dialog"]'));
  overlays = overlays.filter(function(el){
    if( el.style && el.style.display === 'none' ){ return false; }
    if( el.getAttribute && el.getAttribute('data-potaplus-log-dialog') ){ return false; }
    return true;
  });
  var i, form;
  for( i = 0; i < overlays.length; i++ ){
    form = overlays[i].querySelector('.v-form, form');
    if( form ){ return form; }
  }
  var forms = Array.from(document.querySelectorAll('.v-form, form'));
  form = forms.find(function(el){
    var dlg = el.closest('.v-dialog') || el.closest('.v-overlay--active') || el.closest('[role="dialog"]');
    if( ! dlg ){ return false; }
    if( dlg.style && dlg.style.display === 'none' ){ return false; }
    return true;
  });
  if( form ){ return form; }
  if( overlays.length ){
    return overlays[overlays.length - 1].querySelector('.v-card, .v-card-text, .v-row') || overlays[overlays.length - 1];
  }
  return document.querySelector('.v-overlay--active .v-form')
    || document.querySelector('.v-overlay--active form')
    || document.querySelector('[role="dialog"] .v-form')
    || document.querySelector('[role="dialog"] form');
}

function spotFormLayout(form){
  if( ! form ){ return null; }
  return form.querySelector('.v-row')
    || form.querySelector('.v-card-text')
    || form;
}

function findButtonByText(root, re){
  if( ! root ){ return null; }
  return Array.from(root.querySelectorAll('button, .v-btn')).find(function(b){
    return re.test((b.innerText || b.textContent || '').trim());
  }) || null;
}

function findLabelInput(root, re){
  if( ! root ){ return null; }
  var label = Array.from(root.querySelectorAll('label, .v-label, .v-field-label')).find(function(el){
    return re.test((el.innerText || el.textContent || '').trim());
  });
  if( ! label ){ return null; }
  if( label.nextSibling && label.nextSibling.value !== undefined ){
    return label.nextSibling;
  }
  var wrap = label.closest('.v-input, .v-field, .v-text-field, div');
  return wrap ? wrap.querySelector('input, textarea') : null;
}

function findSpotsToolbarAnchor(){
  // pota.app spots header (Oct 2026): .header-actions next to the View picker.
  var headerActions = document.querySelector('.header-actions');
  if( headerActions ){
    return { el: headerActions, mode: 'next-actions' };
  }
  var spotsShown = Array.from(document.querySelectorAll('span, h1, h2, div, p')).find(function(el){
    return /\bspots? shown\b/i.test((el.textContent || '').trim()) && (el.textContent || '').trim().length < 40;
  });
  if( spotsShown && spotsShown.parentElement ){
    return { el: spotsShown.parentElement, mode: 'next-count' };
  }
  var filters = document.querySelector('.horizontal-list-container') || document.querySelector('ul.horizontal-list');
  if( filters && filters.parentElement ){
    return { el: filters.parentElement, mode: 'next-filters' };
  }
  var main = document.querySelector('main') || document.querySelector('#app') || document.body;
  return { el: main, mode: 'fallback' };
}

function encodeLogParam(v){
  return encodeURIComponent(v == null ? '' : String(v));
}

function encodeLogTemplate(s){
  return encodeLogParam(s)
    .replace(/%5F%5FCOMMENTS%5F%5F/gi, '__COMMENTS__')
    .replace(/%5F%5FPARK_NUMS%5F%5F/gi, '__PARK_NUMS__')
    .replace(/%5F%5FLOG4OM_PARKS%5F%5F/gi, '__LOG4OM_PARKS__')
    .replace(/%5F%5FDATE_YYYYMMDD%5F%5F/gi, '__DATE_YYYYMMDD__')
    .replace(/%5F%5FDATE_YYYY_MM_DD%5F%5F/gi, '__DATE_YYYY_MM_DD__')
    .replace(/%5F%5FTIME_HHMMSS%5F%5F/gi, '__TIME_HHMMSS__')
    .replace(/%5F%5FTIME_HHMM%5F%5F/gi, '__TIME_HHMM__');
}

function appendPotaAdifFields(additionalFields){
  additionalFields = additionalFields || '';
  var lower = additionalFields.toLowerCase();
  if( lower.indexOf('sig_info=') === -1 ){
    additionalFields += '&SIG=POTA&SIG_INFO=__PARK_NUMS__';
  }
  if( lower.indexOf('pota_ref=') === -1 ){
    additionalFields += '&POTA_REF=__PARK_NUMS__';
  }
  return additionalFields;
}

function appendStationAndGrid(additionalFields, mycall, parkInfo){
  additionalFields = additionalFields || '';
  var lower = additionalFields.toLowerCase();
  if( mycall && lower.indexOf('station_callsign=') === -1 ){
    additionalFields += '&STATION_CALLSIGN=' + encodeLogParam(mycall);
  }
  var grid = (parkInfo && (parkInfo.grid6 || parkInfo.grid4)) || '';
  if( grid && lower.indexOf('gridsquare=') === -1 ){
    additionalFields += '&GRIDSQUARE=' + encodeLogParam(grid);
  }
  return additionalFields;
}

function formatNoaaFlux(rec){
  if( ! rec || rec.flux == null ){
    return '';
  }
  var n = Number(rec.flux);
  return Number.isFinite(n) ? String(Math.round(n)) : String(rec.flux);
}

function parseNoaaKpRecord(data){
  if( ! data ){
    return null;
  }
  var rec = data;
  if( Array.isArray(data) ){
    rec = data[data.length - 1];
    if( Array.isArray(rec) && rec[0] === 'time_tag' ){
      rec = data.length > 1 ? data[data.length - 1] : null;
    }
  }
  if( Array.isArray(rec) ){
    return { time_tag: rec[0], kp: rec[1], a_running: rec[3] };
  }
  if( rec && typeof rec === 'object' ){
    var kp = rec.Kp != null ? rec.Kp : (rec.kp_index != null ? rec.kp_index : rec.kp);
    return {
      time_tag: rec.time_tag,
      kp: kp,
      a_running: rec.a_running
    };
  }
  return null;
}

function latestNoaaFlux(data){
  if( ! data ){
    return null;
  }
  if( Array.isArray(data) ){
    var rows = data.filter(function(r){ return r && r.flux != null; });
    if( ! rows.length ){
      return data[0] || null;
    }
    rows.sort(function(a,b){
      return String(b.time_tag || '').localeCompare(String(a.time_tag || ''));
    });
    return rows[0];
  }
  return data;
}

function setOptionsDefaults( options ){
	if( ! options ){
	  options = {};
	}
	options.qsyConfig = options.qsyConfig || {};
	options.loggingConfig = options.loggingConfig || {};
	options.rotorConfig = options.rotorConfig || {};
        options.qsyConfig.dataMode ||= 'USB';
        options.qsyConfig.cwMode ||= 'CW';
	if( ! options.hasOwnProperty('enableNeededLocations') ){
	  options.enableNeededLocations = true;
	}
	if( options.enableNeededLocations && options.enableNeededWAS ){
	  // Locations takes precedence (and includes WAS by definition), so treat WAS as disabled.
	  options.enableNeededWAS = false;
	}
	if( ! options.hasOwnProperty('enableSpotFilters') ){
	  options.enableSpotFilters = true;
	}
	if( ! options.hasOwnProperty('enableMyAwards') ){
	  options.enableMyAwards = true;
	}
	return options;
}

///////////////////////////////////////////////////////

function youngerThan( t, ageHours ){
  var millis = Date.now() - t;
  var hrs = millis / 1000 / 60 / 60;
  //hrs = Math.floor(hrs);
  return hrs <= ageHours;
}

function band2Mhz (band) {
	var match = (band || '').match( /(\d+)(\D+)/ );
	if( ! match ){
		return 0;
	}
	var mhz   = match[1];
	var units = match[2];
	if( units == 'CM' ){
		mhz /= 100.0
	}
	return mhz;
}


function compareBands(a,b){
	var aa = band2Mhz(a);
	var bb = band2Mhz(b);
	return aa<bb ? -1 : aa==bb ? 0 : 1
}
