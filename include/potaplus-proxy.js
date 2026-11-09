// POTAPlus ham-apps-proxy client and logger/rig/rotor URL registry.
//
// Adding a logger or rig backend:
//  1. Add a builder to QSY / LOGGING / ROTOR below. Keep the same URL path
//     and query params the proxy already documents (wire contract).
//  2. Add an <option> in options.html (qsy_method / log_method / rotor_method).
//  3. Add the Perl handler in ham-apps-proxy/src/ham-apps-proxy.pl
//     (%BACKENDS + %dispatch + resp_*).
//
// /capabilities is optional. Proxies before 1.09.00 404 it; this module then
// behaves as it did against 1.08.03 (1s post-log ping delay).

var PotaPlusProxy = (function(){
  var capCache = {};
  var capInflight = {};

  function proxyBaseUrl(cfg){
    if( ! cfg || ! cfg.proto || cfg.host == null || cfg.port == null ){
      return '';
    }
    return String(cfg.proto) + '://' + String(cfg.host) + ':' + String(cfg.port);
  }

  function targetParams(cfg){
    var p = '';
    if( cfg && cfg.target_host ){
      p += '&__host=' + cfg.target_host;
    }
    if( cfg && cfg.target_port ){
      p += '&__port=' + cfg.target_port;
    }
    return p;
  }

  function cacheKey(cfg){
    return proxyBaseUrl(cfg);
  }

  function rememberCaps(cfg, caps){
    var key = cacheKey(cfg);
    if( key ){
      capCache[key] = caps || { legacy: true };
    }
    return capCache[key] || { legacy: true };
  }

  function cachedCaps(cfg){
    var key = cacheKey(cfg);
    return key && capCache[key] ? capCache[key] : null;
  }

  function parseCapabilitiesPayload(body){
    if( ! body || typeof body !== 'object' ){
      return { legacy: true };
    }
    var data = body.data && typeof body.data === 'object' ? body.data : body;
    if( ! data.version && ! data.udp_skip_read && ! data.backends ){
      return { legacy: true };
    }
    return {
      legacy: false,
      version: data.version || '',
      udp_skip_read: !!data.udp_skip_read,
      tcp_ping: data.tcp_ping || '',
      backends: data.backends || []
    };
  }

  function probeCapabilities(cfg, fetchFn){
    var key = cacheKey(cfg);
    if( ! key ){
      return Promise.resolve({ legacy: true });
    }
    if( capCache[key] ){
      return Promise.resolve(capCache[key]);
    }
    if( capInflight[key] ){
      return capInflight[key];
    }
    var fetchImpl = fetchFn || fetch;
    capInflight[key] = fetchImpl(key + '/capabilities', { method: 'GET' })
      .then(function(r){
        if( ! r || ! r.ok ){
          return rememberCaps(cfg, { legacy: true });
        }
        return r.json().then(function(body){
          return rememberCaps(cfg, parseCapabilitiesPayload(body));
        });
      })
      .catch(function(){
        return rememberCaps(cfg, { legacy: true });
      })
      .then(function(caps){
        delete capInflight[key];
        return caps;
      });
    return capInflight[key];
  }

  // 1.08.x UDP log occupies the single-threaded proxy for ~1s. Delay the
  // post-log ping to match that stall. 1.09.00 skip-reads UDP, so ping can
  // be queued immediately behind the log request.
  function pingDelayMs(cfg){
    var caps = cachedCaps(cfg);
    if( caps && ! caps.legacy && caps.udp_skip_read ){
      return 0;
    }
    return 1000;
  }

  function commentString(park_num, park_region, parkInfo, park_name){
    var grid = (parkInfo && (parkInfo.grid6 || '')) || '';
    return '[POTA'
      + ' ' + park_num
      + ' ' + park_region
      + ' ' + grid
      + ' ' + park_name
      + '] __COMMENTS__';
  }

  function buildLogAdditionalFields(options, ctx){
    options = options || {};
    var cfg = options.loggingConfig || {};
    var parkInfo = (ctx && ctx.parkInfo) || {};
    var additionalFields = '';
    Object.keys(cfg.additionalADIFFields || {}).forEach(function(key){
      var value = cfg.additionalADIFFields[key];
      value = value.replaceAll('%MYCALL%', ctx.mycall || '');
      value = value.replaceAll('%PARKREF%', '__PARK_NUMS__');
      value = value.replaceAll('%GRID4%', parkInfo.grid4 || '');
      value = value.replaceAll('%GRID6%', parkInfo.grid6 || '');
      additionalFields += '&' + encodeLogParam(key) + '=' + encodeLogTemplate(value);
    });
    if( cfg.parkNumADIFField
        && String(cfg.parkNumADIFField).trim()
        && ! String(cfg.parkNumADIFField).match(/__DEPRECATED__/)
      ){
      additionalFields += '&'
        + String(cfg.parkNumADIFField).trim().split(/[, ]+/).map(function(k){
          return k + '=__PARK_NUMS__';
        }).join('&');
    }
    if( cfg.method !== 'aclog' ){
      additionalFields = appendPotaAdifFields(additionalFields);
    }
    if( options.enableAdifGeo ){
      additionalFields = appendAdifGeoFields(additionalFields, ctx.park_region);
    }
    if( cfg.method !== 'aclog' && cfg.method !== 'qrz' ){
      additionalFields = appendStationAndGrid(additionalFields, ctx.mycall, parkInfo);
    }
    if( cfg.method === 'aclog' ){
      var aclogGrid = parkInfo.grid6 || parkInfo.grid4 || '';
      if( aclogGrid && additionalFields.toLowerCase().indexOf('grid=') === -1 ){
        additionalFields += '&GRID=' + encodeLogParam(aclogGrid);
      }
    }
    return additionalFields;
  }

  var QSY = {
    commander: function(ctx){
      return {
        url: ctx.baseURL + '/dxlab/commander/CmdSetFreqMode'
          + '?xcvrfreq=' + ctx.freq
          + '&xcvrmode=' + ctx.mode
          + '&preservesplitanddual=N'
          + ctx.baseParams
      };
    },
    omnirig: function(ctx){
      return {
        url: ctx.baseURL + '/omnirig/qsy'
          + '?freq=' + (ctx.freq * 1000)
          + '&mode=' + ctx.mode
          + ctx.baseParams
      };
    },
    aclog: function(ctx){
      var clarCats = ctx.cwTxClar
        ? yaesuTxClarCat(/CW/i.test(ctx.logmode || ''), ctx.cwTxClarOffset, ctx.cwTxClarStyle)
        : [];
      if( ! aclogProxyIsWd4dan(ctx.config) ){
        var freqParams = 'value=' + (ctx.freq / 1000.0) + '&suppressmodedefault=TRUE';
        var steps = [
          { url: ctx.baseURL + '/aclog/changemode?value=' + encodeLogParam(ctx.mode) + ctx.baseParams },
          { url: ctx.baseURL + '/aclog/changefreq?' + freqParams + ctx.baseParams },
          { waitMs: 500 },
          { url: ctx.baseURL + '/aclog/changefreq?' + freqParams + ctx.baseParams }
        ];
        clarCats.forEach(function(cat){
          steps.push({ url: ctx.baseURL + '/aclog/sendrigcommand?value=' + encodeLogParam(cat) + ctx.baseParams });
        });
        return { chain: steps };
      }
      var aclogFreq = encodeLogTemplate('<CMD><CHANGEFREQ><VALUE>' + (ctx.freq / 1000.0) + '</VALUE><SUPPRESSMODEDEFAULT>TRUE</SUPPRESSMODEDEFAULT></CMD>');
      return {
        url: ctx.baseURL + '/aclog/?'
          + aclogCommandQuery([
            encodeLogTemplate('<CMD><CHANGEMODE><VALUE>' + ctx.mode + '</VALUE></CMD>'),
            aclogFreq
          ])
          + ctx.baseParams,
        later: {
          waitMs: 500,
          url: ctx.baseURL + '/aclog/?'
            + aclogCommandQuery([aclogFreq].concat(clarCats.map(aclogRigCommand)))
            + ctx.baseParams
        }
      };
    },
    logger32: function(ctx){
      return {
        url: ctx.baseURL + '/logger32/qsy'
          + '?APP_SET_FREQ_MODE=' + ctx.freq
          + '|' + ctx.mode
          + ctx.baseParams
      };
    }
  };

  var LOGGING = {
    dxkeeper: function(ctx){
      return {
        url: ctx.baseURL + '/dxlab/dxkeeper/log'
          + '?' + 'CALL=__CALL__'
          + '&RST_SENT=__RST_SENT__'
          + '&RST_RCVD=__RST_RCVD__'
          + '&FREQ=' + (ctx.freq / 1000.0)
          + '&FREQ_RX=' + (ctx.freq / 1000.0)
          + '&BAND=' + encodeLogParam(ctx.band)
          + '&MODE=' + encodeLogParam(ctx.mode)
          + '&COMMENT=' + encodeLogTemplate(ctx.commentStr)
          + '&QSO_DATE=__DATE_YYYYMMDD__'
          + '&TIME_ON=__TIME_HHMMSS__'
          + '&TX_PWR=__TX_PWR__'
          + '&RX_PWR=__RX_PWR__'
          + ctx.additionalFields
          + ctx.baseParams,
        ping_url: ctx.baseURL + '/dxlab/dxkeeper/ping' + '?' + ctx.baseParams
      };
    },
    logger32: function(ctx){
      return {
        url: ctx.baseURL + '/logger32/log'
          + '?' + 'CALL=__CALL__'
          + '&RST_SENT=__RST_SENT__'
          + '&RST_RCVD=__RST_RCVD__'
          + '&FREQ=' + (ctx.freq / 1000.0)
          + '&FREQ_RX=' + (ctx.freq / 1000.0)
          + '&MODE=' + encodeLogParam(ctx.mode)
          + '&COMMENT=' + encodeLogTemplate(ctx.commentStr)
          + '&QSO_DATE=__DATE_YYYYMMDD__'
          + '&TIME_ON=__TIME_HHMMSS__'
          + '&RX_PWR=__RX_PWR__'
          + '&BAND=' + encodeLogParam(ctx.band)
          + ctx.additionalFields
          + ctx.baseParams,
        ping_url: ctx.baseURL + '/logger32/ping' + '?' + ctx.baseParams
      };
    },
    log4om: function(ctx){
      return {
        url: ctx.baseURL + '/log4om/log'
          + '?' + 'CALL=__CALL__'
          + '&RST_SENT=__RST_SENT__'
          + '&RST_RCVD=__RST_RCVD__'
          + '&FREQ=' + (ctx.freq / 1000.0)
          + '&FREQ_RX=' + (ctx.freq / 1000.0)
          + '&BAND=' + encodeLogParam(ctx.band)
          + '&MODE=' + encodeLogParam(ctx.mode)
          + '&COMMENT=' + encodeLogTemplate(ctx.commentStr)
          + '&QSO_DATE=__DATE_YYYYMMDD__'
          + '&TIME_ON=__TIME_HHMMSS__'
          + '&TX_PWR=__TX_PWR__'
          + '&RX_PWR=__RX_PWR__'
          + '&APP_L4ONG_QSO_AWARD_REFERENCES=__LOG4OM_PARKS__'
          + ctx.additionalFields
          + ctx.baseParams,
        ping_url: ctx.baseURL + '/log4om/ping' + '?' + ctx.baseParams
      };
    },
    aclog: function(ctx){
      if( aclogProxyIsWd4dan(ctx.config) ){
        return {
          url: ctx.baseURL + '/aclog/?'
            + aclogCommandQuery([
              aclogAction('CLEAR'),
              aclogUpdate('TXTENTRYCALL', '__CALL__'),
              aclogAction('CALLTAB'),
              aclogUpdate('TXTENTRYFREQUENCY', encodeLogParam(ctx.freq / 1000.0)),
              aclogUpdate('TXTENTRYMODE', encodeLogParam(ctx.mode)),
              aclogUpdate('TXTENTRYDATE', '__DATE_YYYY_MM_DD__'),
              aclogUpdate('TXTENTRYTIMEON', '__TIME_HHMM__'),
              aclogUpdate('TXTENTRYTIMEOFF', '__TIME_HHMM__'),
              aclogUpdate('TXTENTRYRSTR', '__RST_RCVD__'),
              aclogUpdate('TXTENTRYRSTS', '__RST_SENT__'),
              aclogUpdate('TXTENTRYCOMMENTS', encodeLogTemplate(ctx.commentStr))
            ].concat(
              aclogFieldUpdates(ctx.additionalFields),
              [ aclogAction('ENTER') ]
            ))
            + ctx.baseParams
        };
      }
      return {
        url: ctx.baseURL + '/aclog/updateandlog'
          + '?' + 'CALL=__CALL__'
          + '&MODE=' + encodeLogParam(ctx.mode)
          + '&FREQ=' + (ctx.freq / 1000.0)
          + '&RSTR=__RST_RCVD__'
          + '&RSTS=__RST_SENT__'
          + '&COMMENTS=' + encodeLogTemplate(ctx.commentStr)
          + '&DATE=__DATE_YYYY_MM_DD__'
          + '&TIMEON=__TIME_HHMM__'
          + '&TIMEOFF=__TIME_HHMM__'
          + '&POWER=__TX_PWR__'
          + ctx.additionalFields
          + ctx.baseParams
      };
    },
    qrz: function(ctx){
      return {
        url: 'CALL=__CALL__'
          + '&RST_SENT=__RST_SENT__'
          + '&RST_RCVD=__RST_RCVD__'
          + '&FREQ=' + (ctx.freq / 1000.0)
          + '&FREQ_RX=' + (ctx.freq / 1000.0)
          + '&BAND=' + encodeLogParam(ctx.band)
          + '&MODE=' + encodeLogParam(ctx.mode)
          + '&STATION_CALLSIGN=' + encodeLogParam(ctx.mycall || '')
          + '&OPERATOR=' + encodeLogParam(ctx.mycall || '')
          + '&COMMENT=' + encodeLogTemplate(ctx.commentStr)
          + '&QSO_DATE=__DATE_YYYYMMDD__'
          + '&TIME_ON=__TIME_HHMMSS__'
          + '&TX_PWR=__TX_PWR__'
          + '&RX_PWR=__RX_PWR__'
          + ctx.additionalFields,
        direct: true
      };
    }
  };

  var ROTOR = {
    pst: function(ctx){
      return {
        url: ctx.baseURL + '/pst?QRA=' + ctx.parkGrid + ctx.baseParams
      };
    }
  };

  function buildQsy(qsyConfig, spot){
    qsyConfig = qsyConfig || {};
    var method = qsyConfig.method;
    var builder = QSY[method];
    if( ! builder ){
      return null;
    }
    return builder({
      config: qsyConfig,
      baseURL: proxyBaseUrl(qsyConfig),
      baseParams: targetParams(qsyConfig),
      freq: spot.freq,
      mode: spot.mode,
      logmode: spot.logmode,
      cwTxClar: qsyConfig.cwTxClar,
      cwTxClarOffset: qsyConfig.cwTxClarOffset,
      cwTxClarStyle: qsyConfig.cwTxClarStyle
    });
  }

  function runQsy(qsyConfig, spot, fetchFn){
    var plan = buildQsy(qsyConfig, spot);
    if( ! plan ){
      return Promise.resolve();
    }
    if( plan.chain ){
      return plan.chain.reduce(function(p, step){
        return p.then(function(){
          if( step.waitMs ){
            return new Promise(function(resolve){ setTimeout(resolve, step.waitMs); });
          }
          return fetchFn(step.url, {});
        });
      }, Promise.resolve());
    }
    if( plan.later ){
      fetchFn(plan.url, {});
      setTimeout(function(){ fetchFn(plan.later.url, {}); }, plan.later.waitMs || 500);
      return Promise.resolve();
    }
    if( plan.url ){
      return fetchFn(plan.url, {});
    }
    return Promise.resolve();
  }

  function buildLog(options, spot){
    options = options || {};
    var cfg = options.loggingConfig || {};
    var method = cfg.method;
    var builder = LOGGING[method];
    if( ! builder ){
      return { url: '', ping_url: '' };
    }
    var parkInfo = spot.parkInfo || {};
    var additionalFields = buildLogAdditionalFields(options, {
      mycall: spot.mycall,
      parkInfo: parkInfo,
      park_region: spot.park_region
    });
    var commentStr = commentString(spot.park_num, spot.park_region, parkInfo, spot.park_name);
    return builder({
      config: cfg,
      baseURL: proxyBaseUrl(cfg),
      baseParams: targetParams(cfg),
      freq: spot.freq,
      band: spot.band,
      mode: spot.mode,
      additionalFields: additionalFields,
      commentStr: commentStr,
      mycall: spot.mycall || ''
    });
  }

  function buildRotor(rotorConfig, parkGrid){
    rotorConfig = rotorConfig || {};
    var builder = ROTOR[rotorConfig.method];
    if( ! builder ){
      return null;
    }
    return builder({
      baseURL: proxyBaseUrl(rotorConfig),
      baseParams: targetParams(rotorConfig),
      parkGrid: parkGrid
    });
  }

  function methodIds(map){
    return Object.keys(map);
  }

  return {
    QSY: QSY,
    LOGGING: LOGGING,
    ROTOR: ROTOR,
    proxyBaseUrl: proxyBaseUrl,
    targetParams: targetParams,
    probeCapabilities: probeCapabilities,
    cachedCaps: cachedCaps,
    pingDelayMs: pingDelayMs,
    buildQsy: buildQsy,
    runQsy: runQsy,
    buildLog: buildLog,
    buildLogAdditionalFields: buildLogAdditionalFields,
    buildRotor: buildRotor,
    qsyMethods: function(){ return methodIds(QSY); },
    loggingMethods: function(){ return methodIds(LOGGING); },
    rotorMethods: function(){ return methodIds(ROTOR); }
  };
})();
