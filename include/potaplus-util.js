
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
  return h === 'pota.app' || h === 'www.pota.app' || h === 'next.pota.app' || h === 'dev.pota.app';
}

function isPotaDevHost(){
  return (location.hostname || '') === 'dev.pota.app';
}

// dev.pota.app talks to its own backend; everything else uses production.
var POTA_API = isPotaDevHost() ? 'https://devapi.pota.app' : 'https://api.pota.app';

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
    if( ! window.__POTAPLUS_AUTH_MSG__ ){
      window.__POTAPLUS_AUTH_MSG__ = true;
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
        try { window.dispatchEvent(new Event('potaplus-auth')); } catch (e2) {}
      });
    }
    window.addEventListener('potaplus-auth', tick);
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

function getPotaPlusPark(){
  var park = document.getElementById('potaplus_park');
  if( ! park ){
    park = document.createElement('div');
    park.id = 'potaplus_park';
    park.hidden = true;
    park.style.display = 'none';
    (document.documentElement || document.body).appendChild(park);
  }
  return park;
}

function isParkedPotaPlusParent(el){
  return !!(el && el.id === 'potaplus_park');
}

function parkPotaPlusNode(n){
  if( ! n ){
    return;
  }
  n.style.display = 'none';
  if( isLoosePotaPlusParent(n.parentElement) || ! n.parentElement ){
    getPotaPlusPark().appendChild(n);
  }
}

function hidePotaPlusPageChrome(){
  var ids = ['potaplus_toolbar', 'potaplus_widgets', 'potaplus_infostrip', 'scan_container'];
  ids.forEach(function(id){
    parkPotaPlusNode(document.getElementById(id));
  });
}

function showPotaPlusPageChrome(){
  var tb = document.getElementById('potaplus_toolbar');
  var w = document.getElementById('potaplus_widgets');
  var s = document.getElementById('potaplus_infostrip');
  if( tb && ! isLoosePotaPlusParent(tb.parentElement) && ! isParkedPotaPlusParent(tb.parentElement) ){
    tb.style.display = '';
  }
  if( w && ! isLoosePotaPlusParent(w.parentElement) && ! isParkedPotaPlusParent(w.parentElement) ){
    w.style.display = '';
  }
  if( s && ! isLoosePotaPlusParent(s.parentElement) && ! isParkedPotaPlusParent(s.parentElement) ){
    s.style.display = '';
  }
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
  if( n.id && /^potaplus_|^filter_container$|^scan_container$|^spacewx_container$|^myawards_container$|^earned_container$|^widget_rigref_container$/.test(n.id) ){
    return true;
  }
  return !!(n.closest && n.closest('#potaplus_toolbar, #potaplus_widgets, #potaplus_infostrip, #potaplus_log_dialog, [data-potaplus-log-dialog], [data-marker]'));
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

var AWARDS_HISTORY_PAGE = 10;

function earnedAwardId(row){
  row = normalizeEarnedAward(row);
  if( ! row ){ return ''; }
  return [
    row.dateGranted || row.granted || row.date || '',
    row.awardName || row.name || '',
    row.badgeNum || '',
    row.endorsements || '',
    row.reference || '',
    row.parkName || '',
    row.operator || row.operatorCallsign || ''
  ].join('|');
}

function earnedAwardDate(row){
  row = normalizeEarnedAward(row);
  if( ! row ){ return ''; }
  var d = row.dateGranted || row.granted || row.date || '';
  return typeof d === 'string' ? d : String(d || '');
}

function compareAwardDateDesc(a, b){
  var da = earnedAwardDate(a);
  var db = earnedAwardDate(b);
  if( da === db ){ return 0; }
  return da < db ? 1 : -1;
}

function emptyAwardsLastSeen(){
  return { date: '', ids: [] };
}

function normalizeAwardsLastSeen(entry){
  if( ! entry || typeof entry !== 'object' || Array.isArray(entry) ){
    return emptyAwardsLastSeen();
  }
  var ids = Array.isArray(entry.ids) ? entry.ids.map(String).filter(Boolean) : [];
  var date = typeof entry.date === 'string' ? entry.date : '';
  return { date: date, ids: ids };
}

function parseAwardsUserMap(payload){
  if( ! payload || typeof payload !== 'object' || Array.isArray(payload) ){
    return {};
  }
  return payload;
}

function awardsLastSeenForUser(map, callsign){
  var src = parseAwardsUserMap(map);
  return normalizeAwardsLastSeen(src[userFilterKey(callsign)]);
}

function awardsPanelOpenForUser(map, callsign){
  var src = parseAwardsUserMap(map);
  return !!src[userFilterKey(callsign)];
}

function setAwardsPanelOpenMap(map, callsign, open){
  var next = Object.assign({}, parseAwardsUserMap(map));
  next[userFilterKey(callsign)] = !!open;
  return next;
}

function setAwardsLastSeenMap(map, callsign, entry){
  var next = Object.assign({}, parseAwardsUserMap(map));
  next[userFilterKey(callsign)] = normalizeAwardsLastSeen(entry);
  return next;
}

function snapshotAwardsLastSeen(rows){
  var ids = [];
  var maxDate = '';
  (rows || []).forEach(function(row){
    var id = earnedAwardId(row);
    if( id ){ ids.push(id); }
    var d = earnedAwardDate(row);
    if( d && d > maxDate ){ maxDate = d; }
  });
  return { date: maxDate, ids: ids };
}

function mergeAwardsLastSeen(prev, rows){
  var base = normalizeAwardsLastSeen(prev);
  var snap = snapshotAwardsLastSeen(rows);
  var seen = {};
  base.ids.concat(snap.ids).forEach(function(id){ seen[id] = true; });
  return {
    date: snap.date > base.date ? snap.date : base.date,
    ids: Object.keys(seen)
  };
}

function isAwardsLastSeenSeeded(lastSeen){
  lastSeen = normalizeAwardsLastSeen(lastSeen);
  return !!(lastSeen.date || (lastSeen.ids && lastSeen.ids.length));
}

function isNewEarnedAward(row, lastSeen){
  lastSeen = normalizeAwardsLastSeen(lastSeen);
  if( ! isAwardsLastSeenSeeded(lastSeen) ){
    return false;
  }
  var id = earnedAwardId(row);
  if( id && lastSeen.ids.indexOf(id) !== -1 ){
    return false;
  }
  return !!(id || earnedAwardDate(row));
}

function filterNewEarnedAwards(rows, lastSeen){
  return (rows || []).filter(function(row){
    return isNewEarnedAward(row, lastSeen);
  });
}

function sliceAwardsHistory(rows, shownCount){
  var list = (rows || []).slice().sort(compareAwardDateDesc);
  var n = shownCount == null ? AWARDS_HISTORY_PAGE : Number(shownCount);
  if( ! isFinite(n) || n < AWARDS_HISTORY_PAGE ){
    n = AWARDS_HISTORY_PAGE;
  }
  return {
    visible: list.slice(0, n),
    remaining: Math.max(0, list.length - n),
    total: list.length
  };
}

function awardsChipLabel(newCount){
  var n = Number(newCount) || 0;
  return n > 0 ? ('New awards (' + n + ')') : 'Awards';
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

function stripLeadingParkRef(text){
  return String(text || '').replace(/^[A-Z]{1,3}-\d{3,5}\s+/i, '');
}

function normalizeParkName(text, cardMode){
  var park_name = String(text || '').trim().replace(/"/g, "'");
  park_name = stripLeadingParkRef(park_name);
  if( cardMode ){
    park_name = park_name.replace(/^[^,]+,\s*/, '');
    park_name = stripLeadingParkRef(park_name);
  }
  return park_name;
}

function parseAllParkReferences(text){
  var out = [];
  var seen = {};
  var re = /\b([A-Z]{1,3}-\d{3,5})\b/gi;
  var m;
  while( (m = re.exec(String(text || ''))) ){
    var ref = m[1].toUpperCase();
    if( ! seen[ref] ){
      seen[ref] = true;
      out.push(ref);
    }
  }
  return out;
}

function parseAlsoParkRefs(text){
  var src = String(text || '');
  var extra = [];
  var also = src.match(/\{Also:\s*([^}]+)\}/i);
  if( also ){
    extra = extra.concat(parseAllParkReferences(also[1]));
  }
  return extra;
}

function nferParkRefs(primaryRef, locationDesc, extraText){
  var primary = String(primaryRef || '').toUpperCase();
  var fromLoc = parseAllParkReferences(locationDesc);
  var fromAlso = parseAlsoParkRefs(extraText);
  var fromText = parseAllParkReferences(extraText);
  var seen = {};
  var out = [];
  [fromLoc, fromAlso, fromText].forEach(function(list){
    (list || []).forEach(function(ref){
      if( ! ref || ref === primary || seen[ref] ){
        return;
      }
      seen[ref] = true;
      out.push(ref);
    });
  });
  return out.slice(0, 4);
}

function regionProgramPrefix(region){
  var first = String(region || '').split(',')[0].trim().toUpperCase();
  var i = first.indexOf('-');
  return i === -1 ? first : first.slice(0, i);
}

var POTAPLUS_EU_PREFIXES = {
  AL:1, AD:1, AT:1, AX:1, BA:1, BE:1, BG:1, BY:1, CH:1, CY:1, CZ:1, DE:1,
  DK:1, EE:1, ES:1, FI:1, FO:1, FR:1, GB:1, GE:1, GG:1, GI:1, GR:1, HR:1,
  HU:1, IE:1, IM:1, IS:1, IT:1, JE:1, LI:1, LT:1, LU:1, LV:1, MC:1, MD:1,
  ME:1, MK:1, MT:1, NL:1, NO:1, PL:1, PT:1, RO:1, RS:1, SE:1, SI:1, SJ:1,
  SK:1, SM:1, UA:1, VA:1, XK:1,
  G:1, GD:1, GI:1, GJ:1, GM:1, GU:1, GW:1, EI:1
};

function isUsRegion(region){
  return /^US-/i.test(String(region || '').split(',')[0].trim());
}

function isEuRegion(region){
  return !!POTAPLUS_EU_PREFIXES[regionProgramPrefix(region)];
}

function isTypingTarget(el){
  if( ! el ){
    return false;
  }
  var tag = (el.tagName || '').toUpperCase();
  if( tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' ){
    return tag !== 'BUTTON';
  }
  if( el.isContentEditable ){
    return true;
  }
  return !!(el.closest && el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="combobox"], [role="searchbox"], .v-field, .v-select, .v-textarea'));
}

var US_DXCC_EXCEPTIONS = {
  'US-AK': 6,
  'US-HI': 110,
  'US-PR': 202,
  'US-VI': 285,
  'US-GU': 103,
  'US-MP': 166,
  'US-AS': 9,
  'US-UM': 123
};

var PROGRAM_DXCC = {
  US:291, CA:1, MX:50, AU:150, NZ:170, JP:339, DE:230, FR:227, GB:223, G:223,
  IT:248, ES:281, PT:272, NL:263, BE:209, CH:287, AT:206, PL:269, SE:265,
  NO:266, FI:224, DK:221, IE:245, EI:245, CZ:503, SK:504, HU:239, RO:275,
  BG:212, GR:236, HR:497, SI:499, RS:296, BA:501, ME:514, MK:308, AL:7,
  UA:54, BY:29, MD:179, LT:146, LV:145, EE:52, IS:242, LU:254, LI:251,
  MT:257, CY:215, AD:203, MC:247, SM:278, VA:295, BR:108, AR:100, CL:112,
  ZA:462, IN:324, CN:318, KR:137, PH:375, TH:387
};

function adifGeoFromRegion(region){
  var first = String(region || '').split(',')[0].trim().toUpperCase();
  if( ! first ){
    return null;
  }
  var prefix = regionProgramPrefix(first);
  var geo = { region: first, dxcc: null, state: '', ve_prov: '' };
  if( US_DXCC_EXCEPTIONS[first] ){
    geo.dxcc = US_DXCC_EXCEPTIONS[first];
  } else if( prefix === 'US' && /^US-[A-Z]{2}$/.test(first) ){
    geo.dxcc = 291;
    geo.state = first.slice(3);
  } else if( prefix === 'CA' && /^CA-[A-Z]{2}$/.test(first) ){
    geo.dxcc = 1;
    geo.ve_prov = first.slice(3);
  } else if( PROGRAM_DXCC[prefix] ){
    geo.dxcc = PROGRAM_DXCC[prefix];
  }
  if( ! geo.dxcc && ! geo.state && ! geo.ve_prov ){
    return null;
  }
  return geo;
}

function appendAdifGeoFields(additionalFields, region){
  additionalFields = additionalFields || '';
  var geo = adifGeoFromRegion(region);
  if( ! geo ){
    return additionalFields;
  }
  var lower = additionalFields.toLowerCase();
  if( geo.dxcc && lower.indexOf('dxcc=') === -1 ){
    additionalFields += '&DXCC=' + encodeLogParam(geo.dxcc);
  }
  if( geo.state && lower.indexOf('state=') === -1 ){
    additionalFields += '&STATE=' + encodeLogParam(geo.state);
  }
  if( geo.ve_prov && lower.indexOf('ve_prov=') === -1 ){
    additionalFields += '&VE_PROV=' + encodeLogParam(geo.ve_prov);
  }
  return additionalFields;
}

function userFilterKey(callsign){
  var c = String(callsign || '').trim().toUpperCase();
  return c && looksLikeCallsign(c) ? c : '_signedout';
}

function potaplusHuntKeyMap(){
  return [
    { keys: 'L', action: 'Log the selected spot (QSL dialog)' },
    { keys: '← / →', action: 'QSY scan previous / next visible spot' },
    { keys: 'Ctrl-Space', action: 'Start or stop scan' },
    { keys: 'Esc', action: 'Close the POTAPlus log dialog' }
  ];
}

function renderHuntKeyMapHtml(){
  return '<b>Hunt keys</b> ' + potaplusHuntKeyMap().map(function(row){
    return '<span class="potaplus-hunt-key"><kbd>' + row.keys + '</kbd> ' + row.action + '</span>';
  }).join(' · ');
}

function regionPresetHideMap(preset, regions, locationsHunted){
  var hide = {};
  var list = regions || [];
  for( var i = 0; i < list.length; i++ ){
    var r = list[i];
    if( ! r ){
      continue;
    }
    if( ! regionMatchesPreset(preset, r, locationsHunted) ){
      hide[r] = true;
    }
  }
  return hide;
}

function regionMatchesPreset(preset, region, locationsHunted){
  if( ! preset || preset === 'custom' ){
    return true;
  }
  if( preset === 'us' ){
    return isUsRegion(region);
  }
  if( preset === 'eu' ){
    return isEuRegion(region);
  }
  if( preset === 'needed' ){
    if( ! locationsHunted ){
      return true;
    }
    var loc = String(region || '').replace(/,.+/, '');
    return ! findInList(locationsHunted, function(x){ return x && x.locationDesc === loc; });
  }
  return true;
}

function potaplusSpotAlertKey(call, park, region){
  return [String(call || '').toUpperCase(), String(park || '').toUpperCase(), String(region || '').toUpperCase()].join('|');
}

function potaplusSpotAlertKind(park_num, park_region, parksHunted, locationsHunted){
  if( parksHunted == null && locationsHunted == null ){
    return null;
  }
  var atno = false;
  var needed = false;
  if( parksHunted != null ){
    atno = ! findInList(parksHunted, function(x){ return x && x.reference === park_num; });
  }
  if( locationsHunted != null ){
    var loc = String(park_region || '').replace(/,.+/, '');
    needed = ! findInList(locationsHunted, function(x){ return x && x.locationDesc === loc; });
  }
  if( ! atno && ! needed ){
    return null;
  }
  if( atno && needed ){
    return 'atno+region';
  }
  return atno ? 'atno' : 'region';
}

function potaplusSpotAlertDecide(opts){
  opts = opts || {};
  if( ! opts.enabled ){
    return { alert: false, reason: 'off' };
  }
  if( ! opts.kind ){
    return { alert: false, reason: 'not-needed' };
  }
  if( opts.seen && opts.seen[opts.key] ){
    return { alert: false, reason: 'dup' };
  }
  if( ! opts.seeded ){
    return { alert: false, seed: true, reason: 'seed' };
  }
  var throttleMs = Math.max(1, Number(opts.throttleSec) || 15) * 1000;
  if( opts.lastTs && (opts.now - opts.lastTs) < throttleMs ){
    return { alert: false, mark: true, reason: 'throttle' };
  }
  return { alert: true, beep: ! opts.mute, mark: true, reason: 'fire' };
}

// Multi-operator spots carry "operators": "CALL1,CALL2,..."; it is null/absent
// for single-operator spots. Always returns the activator first.
function spotOperatorList(spot){
  var activator = ((spot && spot.activator) || '').toUpperCase().trim();
  var ops = (spot && spot.operators ? String(spot.operators).split(',') : [])
    .map(function(s){ return s.toUpperCase().trim(); })
    .filter(function(s){ return s && s !== activator; });
  return (activator ? [activator] : []).concat(ops.filter(function(s, i){ return ops.indexOf(s) === i; }));
}

function findRespotButton(root){
  if( ! root ){ return null; }
  var slot = root.querySelector('[ext-slot="btn-spot"]');
  // skip POTAPlus's own buttons (e.g. QSL, which lives in the btn-spot slot)
  var notOurs = function(b){ return ! b.closest('[data-marker]'); };
  if( slot && slot.parentElement ){
    var near = Array.from(slot.parentElement.querySelectorAll('button, .v-btn')).find(notOurs);
    if( near ){ return near; }
  }
  var labeled = Array.from(root.querySelectorAll('button, .v-btn, [role="button"]')).filter(notOurs).find(function(b){
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

function isLoosePotaPlusParent(el){
  if( ! el ){
    return true;
  }
  var id = el.id || '';
  var tag = (el.tagName || '').toUpperCase();
  if( tag === 'MAIN' || tag === 'BODY' || tag === 'HTML' ){
    return true;
  }
  if( id === 'app' || id === 'main-content' ){
    return true;
  }
  return !!(el.classList && (
    el.classList.contains('v-application__wrap')
    || el.classList.contains('v-application')
    || el.classList.contains('v-main')
  ));
}

function spotsFilterPanel(){
  return document.querySelector('main .pota-panel') || document.querySelector('.pota-panel');
}

function spotsControlsOpen(){
  // pota.app "Hide controls" unmounts .pota-panel on table/list (desktop) and
  // drops the class on card/map. The mobile header is a different node.
  if( spotsFilterPanel() ){
    return true;
  }
  return !!document.querySelector('.mobile-header-actions');
}

function findSpotsToolbarAnchor(){
  // pota.app spots header (Oct 2026): empty .header-actions span left of the View picker.
  var panel = spotsFilterPanel();
  var headerActions = panel && panel.querySelector('.header-actions');
  if( ! headerActions ){
    headerActions = document.querySelector('.header-actions');
  }
  if( headerActions && ! isLoosePotaPlusParent(headerActions) ){
    return { el: headerActions, mode: 'next-actions' };
  }
  return { el: null, mode: 'none' };
}

function findSpotsWidgetAnchor(){
  var panel = spotsFilterPanel();
  if( panel ){
    return { el: panel, mode: 'after-panel' };
  }
  var mobile = document.querySelector('.mobile-header-actions');
  if( mobile ){
    var row = mobile.closest('.v-row, .v-col, .d-flex') || mobile.parentElement;
    if( row && ! isLoosePotaPlusParent(row) ){
      return { el: row, mode: 'after-panel' };
    }
  }
  return { el: null, mode: 'none' };
}

function findSpotsInfoStripAnchor(){
  var panel = spotsFilterPanel();
  if( ! panel ){
    return { el: null, mode: 'none' };
  }
  // The spots header is display:flex; flex-direction:row; nowrap. A 100%
  // width child on that row sits beside View / Hide controls and crushes
  // the header. Put the strip in the flex-grow column so it stacks under
  // Band/Mode/Program, still inside the card.
  var grow = panel.querySelector(':scope > .flex-grow-1') || panel.querySelector('.flex-grow-1');
  if( grow ){
    return { el: grow, mode: 'inside-grow' };
  }
  return { el: panel, mode: 'after-panel' };
}

function attachPotaPlusHost(host, dest){
  if( ! host || ! dest || ! dest.el || dest.mode === 'none' || dest.mode === 'fallback' ){
    return false;
  }
  if( isLoosePotaPlusParent(dest.el) ){
    return false;
  }
  if( dest.mode === 'inside-panel' || dest.mode === 'inside-grow' ){
    if( host.parentElement === dest.el ){
      return true;
    }
    dest.el.appendChild(host);
    return true;
  }
  if( dest.mode === 'after-panel' || dest.mode === 'after-filters' ){
    if( host.previousElementSibling === dest.el && host.parentElement === dest.el.parentElement ){
      return true;
    }
    dest.el.insertAdjacentElement('afterend', host);
    return true;
  }
  if( host.parentElement === dest.el ){
    return true;
  }
  dest.el.appendChild(host);
  return true;
}

function needsPotaPlusRehome(el){
  return isLoosePotaPlusParent(el) || isParkedPotaPlusParent(el);
}

function syncPotaPlusSpotsChrome(place){
  if( ! spotsControlsOpen() ){
    hidePotaPlusPageChrome();
    return false;
  }
  if( typeof place === 'function' ){
    place();
  }
  showPotaPlusPageChrome();
  return true;
}

function shouldHighlightUnhuntedRegion(locationsHunted){
  return Array.isArray(locationsHunted);
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

// ACLog (via ham-apps-proxy): each query key is sent to ACLog as one raw
// <CMD> string, in sorted key order. The NN: prefix keeps that order and is
// stripped by the proxy. Parts are already URL-encoded (placeholders kept).
function aclogCommandQuery(parts){
  return parts.map(function(p, i){ return ('0' + (i + 1)).slice(-2) + '%3A' + p; }).join('&');
}

function aclogAction(value){
  return encodeLogTemplate('<CMD><ACTION><VALUE>' + value + '</VALUE></CMD>');
}

function aclogUpdate(control, encodedValue){
  return encodeLogTemplate('<CMD><UPDATE><CONTROL>' + control + '</CONTROL><VALUE>')
    + encodedValue
    + encodeLogTemplate('</VALUE></CMD>');
}

function aclogRigCommand(cat){
  return encodeLogTemplate('<CMD><SENDRIGCOMMAND><VALUE>' + cat + '</VALUE></CMD>');
}

// ACLog through ham-apps-proxy: 'wd4dan' = the modified proxy that takes raw
// <CMD> strings as query keys (ham-apps-proxy/src/ham-apps-proxy-wd4dan.pl);
// anything else = the official K2DW proxy (/aclog/<command>?FIELD=...).
function aclogProxyIsWd4dan(cfg){
  return !!(cfg && cfg.aclogProxy === 'wd4dan');
}

// Yaesu TX clarifier CAT commands (sent via ACLog SENDRIGCOMMAND), MAIN band.
// CW: TX CLAR on, RX CLAR off (receive stays on the spot), offset = offsetHz.
// Other modes: TX CLAR off and offset cleared, so phone/data are not left offset.
// style 'cf' (FTDX10, FTDX101, FT-710): CF sets the offset absolutely.
// style 'ru' (FT-991A and older): RC clears, then RU/RD shifts.
function yaesuTxClarCat(isCw, offsetHz, style){
  var hz = Math.max(-9999, Math.min(9999, parseInt(offsetHz, 10) || 0));
  var digits = ('000' + Math.abs(hz)).slice(-4);
  if( style === 'ru' ){
    if( ! isCw || ! hz ){
      return [ 'XT0;', 'RC;' ];
    }
    return [ 'XT1;', 'RT0;', 'RC;', (hz > 0 ? 'RU' : 'RD') + digits + ';' ];
  }
  if( ! isCw || ! hz ){
    return [ 'CF00000000;', 'CF001+0000;' ];
  }
  return [
    'CF00001000;',  // CLAR setting: RX off, TX on
    'CF001' + (hz > 0 ? '+' : '-') + digits + ';',
  ];
}

// "&Other1=..&GRID=.." (encoded) => TXTENTRYOTHER1 / TXTENTRYGRID updates
function aclogFieldUpdates(additionalFields){
  return (additionalFields || '').split('&').filter(function(s){ return s; }).map(function(pair){
    var i = pair.indexOf('=');
    var k = decodeURIComponent(i === -1 ? pair : pair.slice(0, i)).trim().toUpperCase();
    var v = i === -1 ? '' : pair.slice(i + 1);
    if( ! k ){
      return null;
    }
    return aclogUpdate(/^TXTENTRY/.test(k) ? k : 'TXTENTRY' + k, v);
  }).filter(function(s){ return s; });
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
	options.loggingConfig.additionalADIFFields = options.loggingConfig.additionalADIFFields || {};
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
	if( ! options.hasOwnProperty('enableRegionPresets') ){
	  options.enableRegionPresets = true;
	}
	if( ! options.hasOwnProperty('enableNferAutofill') ){
	  options.enableNferAutofill = true;
	}
	if( ! options.hasOwnProperty('enableAdifGeo') ){
	  options.enableAdifGeo = true;
	}
	if( ! options.hasOwnProperty('enableHuntKeys') ){
	  options.enableHuntKeys = true;
	}
	if( ! options.hasOwnProperty('enableSpotAlerts') ){
	  options.enableSpotAlerts = false;
	}
	if( ! options.hasOwnProperty('spotAlertMute') ){
	  options.spotAlertMute = false;
	}
	if( ! options.hasOwnProperty('spotAlertThrottleSec') ){
	  options.spotAlertThrottleSec = 15;
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
