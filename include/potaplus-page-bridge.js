// Runs in the page (MAIN) world so we can read Vue/Pinia + Amplify session
// that the isolated content script cannot see. next.pota.app keeps the
// logged-in callsign on the Pinia "user" store (JWT claim pota:callsign),
// not in the POTA_SETTINGS cookie.
(function () {
  if (window.__POTAPLUS_PAGE_BRIDGE__) {
    return;
  }
  window.__POTAPLUS_PAGE_BRIDGE__ = true;

  function looksLikeCallsign(c) {
    if (!c || typeof c !== 'string') {
      return false;
    }
    return /^[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,5}(\/[A-Z0-9]+)?$/i.test(c.trim());
  }

  function publish(callsign, token) {
    callsign = (callsign || '').toString().trim().toUpperCase();
    token = (token || '').toString().trim();
    if (!callsign && !token) {
      return false;
    }
    var payload = { callsign: callsign, token: token, t: Date.now() };
    try {
      sessionStorage.setItem('POTAPLUS_AUTH', JSON.stringify(payload));
    } catch (e) {}
    try {
      window.postMessage({ source: 'potaplus', type: 'AUTH', callsign: callsign, token: token }, location.origin || '/');
    } catch (e) {}
    return true;
  }

  function fromPinia() {
    var appEl = document.querySelector('#app');
    var app = appEl && appEl.__vue_app__;
    if (!app) {
      return null;
    }
    var pinia = app.config && app.config.globalProperties && app.config.globalProperties.$pinia;
    if (!pinia && app._context && app._context.provides) {
      var symbols = Object.getOwnPropertySymbols(app._context.provides);
      for (var i = 0; i < symbols.length; i++) {
        var cand = app._context.provides[symbols[i]];
        if (cand && cand._s && cand.state) {
          pinia = cand;
          break;
        }
      }
    }
    if (!pinia) {
      return null;
    }
    var user = null;
    try {
      if (pinia.state && pinia.state.value && pinia.state.value.user) {
        user = pinia.state.value.user;
      }
    } catch (e) {}
    if (!user && pinia._s && typeof pinia._s.get === 'function') {
      try {
        var store = pinia._s.get('user');
        if (store) {
          user = store.$state || store;
        }
      } catch (e) {}
    }
    if (!user && pinia._s && typeof pinia._s.forEach === 'function') {
      pinia._s.forEach(function (store) {
        if (user) {
          return;
        }
        var st = store && (store.$state || store);
        if (st && (st.callsign || st.token || st.isAuthenticated)) {
          user = st;
        }
      });
    }
    if (!user) {
      return null;
    }
    var callsign = user.effectiveCallsign || user.callsign || '';
    if (user.actingAs && user.actingAs.callsign) {
      callsign = user.actingAs.callsign;
    }
    return {
      callsign: looksLikeCallsign(callsign) ? callsign : (callsign || ''),
      token: user.token || ''
    };
  }

  function isJwtLike(s) {
    return typeof s === 'string' && s.split('.').length === 3 && s.length > 40;
  }

  function findJwtInObject(obj, depth) {
    if (!obj || depth > 4) {
      return '';
    }
    if (typeof obj === 'string') {
      return isJwtLike(obj) ? obj : '';
    }
    if (typeof obj !== 'object') {
      return '';
    }
    var prefer = ['token', 'idToken', 'jwtToken', 'id_token', 'accessToken'];
    var i;
    for (i = 0; i < prefer.length; i++) {
      if (isJwtLike(obj[prefer[i]])) {
        return obj[prefer[i]];
      }
    }
    try {
      var keys = Object.keys(obj);
      for (i = 0; i < keys.length && i < 50; i++) {
        var nested = findJwtInObject(obj[keys[i]], depth + 1);
        if (nested) {
          return nested;
        }
      }
    } catch (e) {}
    return '';
  }

  function fromVue2() {
    var appEl = document.querySelector('#app');
    var vue = appEl && appEl.__vue__;
    if (!vue) {
      return null;
    }
    var token = '';
    var callsign = '';
    try {
      var store = vue.$store && vue.$store.state;
      if (store) {
        token = findJwtInObject(store, 0);
        callsign = (store.user && (store.user.callsign || store.user.effectiveCallsign)) || store.callsign || '';
      }
    } catch (e) {}
    if (!token) {
      try {
        token = findJwtInObject(vue.$data, 0);
      } catch (e2) {}
    }
    if (!callsign) {
      try {
        callsign = (vue.$data && (vue.$data.callsign || (vue.$data.user && vue.$data.user.callsign))) || '';
      } catch (e3) {}
    }
    if (!token && !callsign) {
      return null;
    }
    return {
      callsign: looksLikeCallsign(callsign) ? callsign : (callsign || ''),
      token: token || ''
    };
  }

  var amplifyStarted = false;
  function fromAmplify() {
    if (amplifyStarted) {
      return false;
    }
    try {
      var Auth = (window.Amplify && window.Amplify.Auth) || window.Auth;
      if (!Auth || typeof Auth.currentSession !== 'function') {
        return false;
      }
      amplifyStarted = true;
      Auth.currentSession().then(function (sess) {
        var jwt = '';
        try {
          jwt = sess && sess.getIdToken && sess.getIdToken().getJwtToken();
        } catch (e) {}
        if (isJwtLike(jwt)) {
          publish('', jwt);
        }
      }).catch(function () {});
      return true;
    } catch (e) {
      return false;
    }
  }

  function harvest() {
    fromAmplify();
    var found = fromPinia() || fromVue2();
    if (found && found.token) {
      return publish(found.callsign, found.token);
    }
    if (found && found.callsign) {
      publish(found.callsign, found.token);
    }
    return false;
  }

  var n = 0;
  if (harvest()) {
    return;
  }
  var iv = setInterval(function () {
    if (harvest() || ++n > 80) {
      clearInterval(iv);
    }
  }, 250);
})();
