
/*
POTAPlus browser extension for POTA.app

Author: David Westbrook K2DW
Contact: dwestbrook@gmail.com or K2DW on POTA Slack workspace.

Support: Direct message or #proj-potaplus-browser-extension channel on POTA Slack workspace

Source & Documentation:
	https://dwestbrook.net/projects/potaplus
*/

var VER = chrome.runtime.getManifest().version;
var POTAPLUS_LATEST_URL = 'https://getontheair.app/downloads/potaplus-latest.json';
var POTAPLUS_GUIDE_URL = 'https://getontheair.app/guide/software/potaplus/';
if (window.__POTAPLUS_FG__) {
  console.log('POTAPlus foreground already loaded');
} else {
window.__POTAPLUS_FG__ = true;
/* potaplus-fg-main */

// add to idea list:  switch from chrome.storage.local to chrome.storage.sync
// idea list:  add hotkeys .. e.g. L to click QSL button for current spot.
//
/////////////////////////
//
// ==== TODO ====
// TODO: HRD
//   https://code.google.com/archive/p/java-hrd-api/
// 	TCP port 7809
// 	set unblock
// 	set frequency-hz 7200000
// 	set dropdown Mode USB
//		FM AM CW CWR DIG USB LSB
//	set block
//   https://support.hamradiodeluxe.com/support/solutions/articles/51000052684-qso-forwarding
//   	UDP port 2333
//   	N1MM format XML
/////////////////////////
// TODO: ACLOg 7.0.5 (May 2022)
// 	http://www.n3fjp.com/help/api.html
// 	API 2.0 (For programs released after 5/01/2022) -- Added ADDADIFRECORD command.
// 	<CMD><ADDADIFRECORD><VALUE><CALL:4>K2DW<QSO_Date:8>20220317<Time_On:6>205405<Time_Off:6>205405<FREQ:5>7.185<Band:3>40M<Mode:3>SSB<RST_SENT:2>59<RST_RCVD:2>57<SIG_INFO:6>K-1234<MY_SIG_INFO:6>K-5678<Comment:17>This is a Comment<EOR></VALUE></CMD>
//  TODO: Base the QSY selectedcall on spotKey instead of callsign

// TODO: Remember TX PWR by Mode... or make default options
// TODO: ACLog UPDATEANDLOG -- email support to confirm what fields it supports.  COMMENTS? Other1?
// 	May have to instead do the individual text fills, and ENTER command.  see KB3CMT slack chat.
//
// TODO: Send DXCC/STATE  ADIF feilds, based on mapping from region (e.g. US-NY =>  291 & NY)
// TODO: in re-spot dialog, add region label.  Unless pota.app implements it:
// 	https://parksontheair.slack.com/archives/C011E0H540J/p1648904978819709?thread_ts=1648231532.399129&cid=C011E0H540J
// TODO: long term idea "Park heat"   change the color of the park depending on how often its active. this way rarely active parks are one color and the more active parks are different color.
// TODO: flag true ATNO
// 		get grid info at same time
// BUG: reports of bts.historyBtn initialization line having error "anonymous function"
// 	https://parksontheair.slack.com/archives/C02TEHESMLG/p1648984983966939
// BUG: op2op count in wrong place in table view for a VK station.
// 	https://parksontheair.slack.com/archives/C02TEHESMLG/p1649808918243489
// 	https://parksontheair.slack.com/archives/C02TEHESMLG/p1651414919488679
// TODO:  Get the pota.app version ... report in version check? have a max-supported?
// 			Build: 2022-04-17_03:48:37_282
// BUG: in card view,  highlight-new-spots causes QSL/~ btn to disappear
// BUG: card view, darkmode=off,  the QSY doesn't highlight selectedcall.
// TODO: Feature-add in log widow, for a "log as" callsign entry.  e.g.  K2DW/40  multi-radio club op.
// TODO -- test out-of-band frequencies  on CARD mode.
// TODO: q{ on logging (opening of modal??), lookup park info;  Include grid, state, dxcc in log entries }, 
// TODO: N1MM Rotor support
/////////////////////////////////////////////////////


// DEBUG STORAGE:
//chrome.storage.local.get(function(result){console.log(result); console.log("Size MB:", JSON.stringify(result).length/1024/1024)} )


var session_info = getPOTASettings();
var potaSettings = session_info.potaSettings;
var TOKEN = session_info.apiToken;
var THEMECLASS = potaSettings.darkMode ? 'theme--dark' : 'theme--light';
var MYCALL = potaSettings.callsign;
console.log("MYCALL: ", MYCALL);

function applyPotaPlusSession(s) {
  if( ! s ){
    s = getPOTASettings();
  }
  session_info = s;
  potaSettings = s.potaSettings;
  TOKEN = s.apiToken;
  THEMECLASS = potaSettings.darkMode ? 'theme--dark' : 'theme--light';
  MYCALL = potaSettings.callsign;
  POTA_API_OPTS = getPotaApiOpts(TOKEN);
  console.log("MYCALL: ", MYCALL);
  if( MYCALL ){
    sendChromeMessage("set__MYCALL", MYCALL);
    sendChromeMessage("set__TOKEN", TOKEN);
  }
  if( typeof loadUserRegionFilter === 'function' ){
    loadUserRegionFilter();
  }
}

sendChromeMessage("set__MYCALL", MYCALL);
sendChromeMessage("set__TOKEN", TOKEN);

var HUNTER_CALLS = {};
chrome.runtime.sendMessage({ message: "get__HUNTER_CALLS" }, response => {
      if (response && response.message === 'success') {
		HUNTER_CALLS = response.payload || {};
		HUNTER_CALLS[ MYCALL ] = Date.now();
		sendChromeMessage("set__HUNTER_CALLS",  HUNTER_CALLS  );
      }
});

var POTA_API_OPTS = getPotaApiOpts(TOKEN);

var info = document.createElement('span');
info.id = 'potaplus_toolbar';
info.innerHTML = `
 <a
	id="upgrade_link"
	target="_blank"
	href="https://getontheair.app/guide/software/potaplus/"
	__href="chrome-extension://${chrome.runtime.id}/options.html"
	__href="javascript:runtime.openOptionsPage(); void(0)"
	style="text-decoration:none;
		border-radius: 8px;
		border: 1px solid lightgreen;
	"
	>
 <input id="btn_info" type=button value="POTAPlus Extension" style="
		font-size:smaller !important;
		padding-left: 5px;
		padding-right: 5px;
		padding-top: 2px;
		padding-bottom: 2px;
	"
	_class="ma-2 v-btn v-btn--is-elevated v-btn--has-bg theme--light v-size--default lightgreen"
	class="title text-xs-left primary--text warning"
  />
	<span id="label_ver" style="
		font-family: monospace;
		border-radius: 3px;
		padding: 2px;
		font-size: smaller;
		display: none;
	    ">v${VER}</span>
	<span id="label_update" style="
		background-color: pink;
		font-family: monospace;
		border-radius: 3px;
		padding: 2px;
		font-size: smaller;
		display: none;
	    ">UPDATE</span>
  </a>
`;
function placeToolbar() {
  var anchor = findSpotsToolbarAnchor();
  if (!anchor || !anchor.el) {
    return false;
  }
  if (info.parentElement === anchor.el) {
    return true;
  }
  if (!info.parentElement || isLoosePotaPlusParent(info.parentElement) || anchor.mode === 'next-actions') {
    anchor.el.appendChild(info);
    return true;
  }
  return true;
}
placeToolbar();

if (document.querySelector('#label_ver')) {
  document.querySelector('#label_ver').innerText = "v" + VER;
}

var MAINTABLE;
var CARDMODE;
var LISTMODE;
var DARKMODE;

var OPTIONS = null;
var LATESTVER = '';
var VERSION_CHECK = '';

function _log(s){
	if( ! OPTIONS || ! OPTIONS.enableLogDisplay ){
	  return;
	}
	console.log("=LOG=", s);
	var box = document.querySelector('#log_container');
	if( ! box ){
	  return;
	}
	var wrap = document.getElementById('log_container_');
	if( wrap ){
	  wrap.style.display = '';
	}
	box.style.display = '';
	box.value += s + "\n";
	box.scrollTop = box.scrollHeight;
}
function _fetch(url, opts){
  var which =	  url.match(/api.pota.app/)	? 'POTA'
		: url.match(/dwestbrook.net/)	? 'PLUS'
		: url.match(/http:/)		? 'PROXY'
		:				  'WEB'
  ;
  _log( `[${which}]: ${url}` );
  var label = document.querySelector('#label_update');
  if( label && ! label.innerText.match(/UPDATE/) ){
	label.style.display = 'none';
  }
  return fetch(url, opts)
	.then(function(response) {
//console.log(response ) ;
		if (!response.ok
//			|| (which=='PROXY' && ! response.payload.success ) // ham-apps-proxy calls are no-cors, so will always be "not ok" with response.status == 0
		    ){
			var s = `FAILED [${response.status}] ${response.statusText} (${which}) ${url}`;
			_log(s);
			_log(response.payload);
			console.log(s);
			console.log(response);
			if( response.status == 403 ){
				var expired = document.querySelector('#label_update');
				if( expired ){
					expired.innerHTML = 'REFRESH (F5) NEEDED (pota.app session expired)';
					expired.style.display = '';
				}
			}
			// throw Error(response.statusText);
		}
		return response;
	})
	.catch(err => {
			var s = `FAILED: (${which}) ${url} ${err}`;
			_log(s);
			var msg = which == 'PROXY'	? 'Check options, ham-apps-proxy, and rig/logging/rotor apps'
				:  which == 'POTA'	? 'Issue with POTA.app -- try refresh/login'
				:			  'Issue with web API call'
			;
			var label = document.querySelector('#label_update');
			if( label ){
			label.style.display = '';
			if( ! label.innerText.match("ERROR") ){
				label.innerHTML = `ERROR -- ${msg}`;
			}
			}
	})
  ;
}

function toggleColor(toggle){
  if( DARKMODE ){
      return  toggle == 1 ? 'blue'
	    : toggle == 2 ? 'grey'
	    : 		    '' ;
  }else{
      return  toggle == 1 ? 'yellow'
	    : toggle == 2 ? 'grey'
	    : 		    '' ;
  }
  return '';
}


function updateVersionLabel() {
	    LATESTVER = VERSION_CHECK.latestVer;
	    // getontheair.app/downloads/potaplus-latest.json reports the current getontheair build.
	    // Only prompt when that remote version is actually newer than this build.
	    if( LATESTVER && comparePotaPlusVersions(LATESTVER, VER) > 0 ){
	      console.log('UPGRADE NEEDED ' + VER + ' => ' + LATESTVER);
	      var up = document.querySelector('#upgrade_link');
	      var lv = document.querySelector('#label_ver');
	      var lu = document.querySelector('#label_update');
	      if( up ){ up.setAttribute('title', 'Upgrade to v'+LATESTVER); }
	      if( lv ){ lv.style.display = ''; }
	      if( lu ){ lu.style.display = ''; }
	    }
	    if( MAINTABLE ){
	      try { pokeMainTable(); } catch (e) {}
	    }
}

function versionCheck() {
  chrome.runtime.sendMessage({ 
        message: "get__VERSION_CHECK"
      }, response => {
      if (response && response.message === 'success') {
	VERSION_CHECK = response.payload;
//console.log("VERSION_CHECK", VERSION_CHECK);
	if( VERSION_CHECK
		&& VERSION_CHECK.updated
		&& youngerThan(VERSION_CHECK.updated,24)
		&& VERSION_CHECK.installedVer == VER
	    ){
		// use cached info
//console.log("using cached VERSION_CHECK ....");
		updateVersionLabel();
		return;
	}
      }
//console.log("FETCHING NEW VERSION_CHECK INFO....");
      // new version check call
      _log("Version check");
      // getontheair.app manifest: no callsign, no options, no settings. Cached for 24h (checked at most once a day).
      chrome.runtime.sendMessage({ message: 'fetch_json', url: POTAPLUS_LATEST_URL }, function(resp){
	    if( chrome.runtime.lastError || ! resp || resp.message !== 'success' || ! resp.payload || ! resp.ok ){
		// remember the failed attempt too, so we still check at most once a day
		sendChromeMessage("set__VERSION_CHECK", { data: null, updated: Date.now(), latestVer: '', installedVer: VER });
		return;
	    }
	    var data = resp.payload;
	    VERSION_CHECK = {
		    data: data,
		    updated: Date.now(),
		    latestVer: data.version,
		    installedVer: VER,
	    };
	    updateVersionLabel();
	    sendChromeMessage("set__VERSION_CHECK",  VERSION_CHECK  );
      });
  });
}

function clock() {
  document.title = new Date().toISOString().slice(11,19) + " Z";
  setTimeout(clock, 1000);
}

function detectLayout() {
  var layout = detectPotaLayout();
  MAINTABLE = layout.MAINTABLE;
  CARDMODE = layout.CARDMODE;
  LISTMODE = layout.LISTMODE;
  DARKMODE = layout.DARKMODE;
}
detectLayout();

chrome.runtime.sendMessage({ 
        message: "get__options"
      }, response => {
      if (response && response.message === 'success') {
	OPTIONS = setOptionsDefaults( response.payload );
//console.log('OPTIONS', OPTIONS);
	versionCheck();
        if( OPTIONS.enableQsy && document.getElementById('scan_container') ){
	    document.getElementById('scan_container').style.display = 'inherit';
        }
	if( OPTIONS.enableMyAwards && document.querySelector('#myawards_container') ){
	    document.querySelector('#myawards_container').style.display = '';
	}
        if( OPTIONS.enableUTCClock ){
		clock();
        }
	if( OPTIONS.enableSpaceWX && document.querySelector('#spacewx_container') ){
	    document.querySelector('#spacewx_container').style.display = '';
	    paintSpaceWx();
	}
	fetchSpaceWx();
	if( OPTIONS.enableGreyLine && document.querySelector('#greyline_container') ){
	    document.querySelector('#greyline_container').style.display = '';
	}
	if( OPTIONS.enableWidget_RigRef && document.querySelector('#widget_rigref_container') ){
	    document.querySelector('#widget_rigref_container').style.display = '';
	}

	if (MAINTABLE) {
	  pokeMainTable(); // touch, to trigger initial update
	}
	loadUserRegionFilter();
	updateHuntKeyMap();
	loadLoggedInHunterData();
      }
});

var TOGGLES = '';
chrome.runtime.sendMessage({ message: "get__TOGGLES" }, response => {
      if (response && response.message === 'success') {
	      TOGGLES = response.payload || {};
      }
});

var TX_PWR = '';
chrome.runtime.sendMessage({ message: "get__TX_PWR" }, response => {
      if (response && response.message === 'success') {
	      TX_PWR = response.payload || '';
      }
});

var OPS_HUNTED = null;
chrome.runtime.sendMessage({ message: "get__OPS_HUNTED" }, response => {
      if (response && response.message === 'success') {
	      OPS_HUNTED = response.payload || {};
      }
});

var PARK_INFO = {};
chrome.runtime.sendMessage({ message: "get__PARK_INFO" }, response => {
      if (response && response.message === 'success') {
	      PARK_INFO = response.payload || {};
      }
});

// Needed-Ops logbook crawl removed: pota.app's Op-to-Op chip covers it.

var SPOTS_FEED = null;
chrome.runtime.sendMessage({ message: "get__SPOTS_FEED" }, response => {
      if (response && response.message === 'success') {
	      SPOTS_FEED = response.payload || {};
      }
});

function updateSpotBio( spots ){
	if( ! OPTIONS.enableOpProfileInfo ){
		return;
	}
	if( ! spots ){
		return;
	}
	var div = document.querySelector('#spotbio_container_');
	div.style.fontSize = 'smaller';
	div.style.fontFamily = 'monospace';
	div.style.maxHeight = '200px';
	div.style.overflow = 'scroll';
	var spotsEntries = spots['comments'] || [];
	var parseAlso = {};
	spotsEntries.map( s => s['comments'].match(/{Also:[^}]+}/) ).filter( s => s ).map( s => s[0] ).forEach( s =>  parseAlso[s] = 1 );
	var parseWith = {};
	spotsEntries.map( s => s['comments'].match(/{With:[^}]+}/) ).filter( s => s ).map( s => s[0] ).forEach( s =>  parseWith[s] = 1 );
	div.innerHTML = '';
	if(  Object.keys( parseAlso ).length ){
		div.innerHTML += Object.keys( parseAlso ).sort().join(',') + "<br/>";
		div.innerHTML += '<hr/>';
	}
	if(  Object.keys( parseWith ).length ){
		div.innerHTML += Object.keys( parseWith ).sort().join(',') + "<br/>";
		div.innerHTML += '<hr/>';
	}
	div.innerHTML += spotsEntries
	  .filter( s => s['source']!='RBN' )
	  .map( (s) => {
		// band, comments, frequency, mode, source, spotId, spotTime, spotter
		return [
				  s['spotTime'].match(/T(.....)/)[1].replace(':','')
				, Number(s['frequency'])
				, s['spotter'].padEnd(6,' ').replaceAll(' ','&nbsp;')
				, s['comments']
		].join(' ')
	}).join('<br/>');
}

function updateActivationBio( call, park_num ){
	if( ! OPTIONS.enableOpProfileInfo ){
		return;
	}
	if( ! call || ! park_num ){
		return;
	}
	var div = document.querySelector('#activationbio_container_');
	var data = findInList(ACTIVATIONS, el =>
		el && el['activator'] == call
		&& el['reference'] == park_num
	);
	div.innerHTML = !data ? '' : `
		<b>ACTIVATION:</b>
			${data['startDate']}
				${data['startTime']}
			=&gt;
			${ data['startDate'] == data['endDate'] ? '' : data['endDate'] }
				${data['endTime']}
			&nbsp;&nbsp;
			&nbsp;&nbsp;
			<b>QRV:</b> ${data['frequencies']}
			<br/>
		<i>${data['comments']}</i> <br/>
	`;
	/////////
	var spots = SPOTS_FEED[call] ? SPOTS_FEED[call][park_num] : null;
	if( spots ){
		if( youngerThan( spots.updated, 0.1 ) ){ // TODO -- cache length
			updateSpotBio( SPOTS_FEED[call][park_num] );
			return;
		}
	}
/*	{
  "spotId": 3947057,
  "spotTime": "2022-07-10T15:02:52",
  "spotter": "K9LC-#",
  "mode": "FT8",
  "frequency": "14074.0",
  "band": "20m",
  "source": "RBN",
  "comments": "RBN -14 dB via K9LC-#"
} */
    _fetch(`https://api.pota.app/spot/comments/${encodeURIComponent(call)}/${encodeURIComponent(park_num)}`, POTA_API_OPTS)
    .then(response => response.json())
    .then(data => {
	    var comments = Array.isArray(data) ? data : [];
	    if( comments.length ){
		return comments;
	    }
	    return _fetch('https://api.pota.app/v1/spots?activator=' + encodeURIComponent(call) + '&reference=' + encodeURIComponent(park_num), POTA_API_OPTS)
	      .then(function(r2){ return r2.json(); })
	      .then(function(data2){
		if( Array.isArray(data2) ){ return data2; }
		if( data2 && Array.isArray(data2.spots) ){ return data2.spots; }
		return comments;
	      });
    })
    .then(comments => {
	    SPOTS_FEED[call] ||= {};
	    SPOTS_FEED[call][park_num] = { updated:Date.now(), comments: Array.from(comments || []) };
	    sendChromeMessage("set__SPOTS_FEED",  SPOTS_FEED );
	    updateSpotBio( SPOTS_FEED[call][park_num] );
    }).catch(function(){});
}

var deg2rad = Math.PI / 180;
var rad2deg = 180.0 / Math.PI;
var pi = Math.PI;
var locres = 0; //6 locator characters

function conv_loc_to_deg(locator)
{
 var i = 0;
 var loca = new Array();
 while (i < 10)
  {
  loca[i] = locator.charCodeAt(i) - 65;
  i++;
  }
 loca[2] += 17;
 loca[3] += 17;
 loca[6] += 17;
 loca[7] += 17;
 var lon = (loca[0] * 20 + loca[2] * 2 + loca[4] / 12 + loca[6] / 120 + loca[8] / 2880 - 180);
 var lat = (loca[1] * 10 + loca[3] + loca[5] / 24 + loca[7] / 240 + loca[9] /5760 - 90);
 var geo = { latitude: lat, longitude: lon };
 return(geo);
}

function cos(x)   { return Math.cos(  x); }
function sin(x)   { return Math.sin(  x); }
function acos(x)  { return Math.acos( x); }
function round(x) { return Math.round(x); }

function calc_gc(lat1, lon1, lat2, lon2)
{
var d = acos(sin(lat1) * sin(lat2) + cos(lat1) * cos(lat2) * cos(lon1 - lon2));
var gc_d = round((rad2deg * d) * 60 * 10) / 10;
var gc_dm = round(1.852 * gc_d * 10) / 10;
var gc_ds = round(1.150779 * gc_d * 10) / 10;

if (sin(lon2 - lon1) < 0)
  tc = acos((sin(lat2) - sin(lat1) * cos(d)) / (sin(d) * cos(lat1)));
else if (lon2 - lon1 == 0)
  if (lat2 < lat1)
    tc = deg2rad * 180;
  else
    tc = 0;
else
  tc = 2 * pi - acos((sin(lat2) - sin(lat1) * cos(d)) / (sin(d) * cos(lat1)));

gc_tc = round(tc * rad2deg * 10) / 10;
// Great Circle
// Degrees	Kilometres	Nautical miles	Statute miles
return { deg: gc_tc, km: gc_dm, mi: gc_d, sm: gc_ds };
}


function updateParkBio( p ){
	if( ! OPTIONS.enableOpProfileInfo ){
		return;
	}
	if( ! p || ! p['info'] ){
		return;
	}
	var title = document.querySelector('#parkbio_container_title');
	var div = document.querySelector('#parkbio_container_');
	var divMap = document.querySelector('#parkmap_container_');
	var data = p['info'];
	var stats = p['stats'];
	var mapZoom = 3;
	var mapDim = "100x100";  // W x H pixels
	var longLat = data['longitude'] + ',' + data['latitude'];
	var latLong = data['latitude']  + ',' + data['longitude'];
	// TODO badges ... park hunted ct;  reference count
	title.innerHTML = `
		<span style="font-size:larger">
			${data['reference']}
				${data['name']}
				${data['parktypeDesc']}
				<br/>
		</span>
	`;
	var myGrid = OPTIONS.loggingConfig.homeGrid || '';
	var parkGrid = data['grid6'] || '';
	var distanceInfo = '';  // for distance and bearing HTML
	if( myGrid.length == 6 && parkGrid.length == 6 ){
		var loc1 = myGrid   + '55AA';
		var loc2 = parkGrid + '55AA';

		var geo1 = conv_loc_to_deg(loc1);
		var geo2 = conv_loc_to_deg(loc2);

		var lon1 = geo1.longitude * deg2rad;
		var lat1 = geo1.latitude * deg2rad;

		var lon2 = geo2.longitude * deg2rad;
		var lat2 = geo2.latitude * deg2rad;

		var greatCircle = calc_gc(lat1, -lon1, lat2, -lon2);
		distanceInfo = `
			<div style="
				border: 2px solid black;
				width: fit-content;
				border-radius: 5px;
				padding: 2px;
				margin-left: 25px;
				display: inline;
				">
				&nbsp;&nbsp;
				${round( greatCircle.deg )}&deg;
				&nbsp;&nbsp;
				${round( greatCircle.mi  )} miles
				&nbsp;&nbsp;
			</div>
		`;
		if( OPTIONS.enableRotor ){
			var url;
			var baseURL = OPTIONS.rotorConfig.proto + "://" + OPTIONS.rotorConfig.host + ":" + OPTIONS.rotorConfig.port;
			var baseParams = '';
			if( OPTIONS.rotorConfig.target_host ){ baseParams += '&__host='+OPTIONS.rotorConfig.target_host; }
			if( OPTIONS.rotorConfig.target_port ){ baseParams += '&__port='+OPTIONS.rotorConfig.target_port; }
			if( OPTIONS.rotorConfig.method == 'pst' ){
		          url = baseURL + "/pst?QRA=" + parkGrid + baseParams;
			}
			distanceInfo += `
				&nbsp;
				<span id="rotate_container"
				  class="ma-2 v-btn v-btn--is-elevated v-btn--has-bg theme--light v-size--default secondary"
				  style="
					border-radius: 5px;
					padding: 6px;
					border: 1px solid grey;
					white-space: nowrap;
					"
				  >
					<input id="btn_rotate" type=button value="ROTATE" data-url="${url}" />
				</span>
			`;
		}
	}

	divMap.innerHTML = `
		<iframe width="275" height="175"
			src="https://www.google.com/maps/embed/v1/streetview?key=AIzaSyABwjeMlP3FIw9kHNAA2Wn8WHyQR2cUkjk&location=${latLong}"
			></iframe>
	`;
	div.innerHTML = `
		<a target="_blank"
			style="margin-right:20px; float:left"
			href="${potaAppUrl('/park/' + data['reference'])}"
		><img id="park_map_img"
			src="https://api.pota.app/styles/v1/mapbox/outdoors-v11/static/pin-l-park+f74e4e(${longLat})/${longLat},${mapZoom},0,0/${mapDim}?access_token=pk.eyJ1IjoibjBhdyIsImEiOiJjand6aW5vMHoxZ29qNDluNW1rcnQ1Ymw3In0.Maco-UBPruDo_Gh13oBKPw"
		></a>
		<span style="font-size:smaller">
			${data['grid6']}
				${data['locationDesc']}
				${data['entityName'].replace('United States Of America','U.S.A')}
				<br/>
			${stats['activations']} Activations
				<!-- ${stats['attempts']} -->
				${stats['contacts']} qsos<br/>
			${distanceInfo}
		</span>
	`;
	if( OPTIONS.enableRotor ){
		document.querySelector('#btn_rotate').addEventListener('click', (e2) => {
			var url = e2.target.getAttribute('data-url');
			_fetch( url, { mode: 'no-cors' } );
		} );
	}
}

function updateBio( u ){
	if( ! OPTIONS.enableOpProfileInfo ){
		return;
	}
	if( ! u || ! u['bio'] || ! u['bio']['callsign'] ){
		return;
	}
	var data = u['bio'];
	var otherCalls = data['other_callsigns'] || [];
	var hunter = data['stats']['hunter'] || {};
	var attempts = data['stats']['attempts'] || {};
	var div = document.querySelector('#bio_container_');
	var title = document.querySelector('#bio_container_title');
	var op2opBadge = false ?
		`<span data-marker="OPS_HUNTED" class="v-badge__badge ${ u['ct'] ? 'accent' : 'warning' }" title="Total QSOs with ${data['callsign']}" style="display: NONE; position: relative; top:-3px">${u['ct']}</span>&nbsp;`
		: '';
	title.innerHTML = `
		<span style="font-size:larger"> ${data['callsign']} </span>
			${op2opBadge}
			<span style="font-size:larger"> ${data['name']} </span>
			<br/>
	`;
	div.innerHTML = `
		<div style="height:110px">
		    <a target="_blank"
			style="vertical-align: middle; margin-right:20px; float:left"
			href="${potaAppUrl('/profile/' + data['callsign'])}"
		    ><img id="bio_container_img"
			src="https://www.gravatar.com/avatar/${data['gravatar']}?s=100&amp;d=identicon"
		    ></a>
				${otherCalls.join('<br/>')}
		</div>
		<span style="font-size:smaller">
			<!-- ${data['stats']['awards']} awards ${data['stats']['endorsements']} endorsements	<br/> -->
			Hunted ${hunter['parks']} parks ${hunter['qsos']} qsos	<br/>
			${attempts['activations']} Activations ${attempts['parks']} parks ${attempts['qsos']} qsos	<br/>
			${data['qth'] ? "Home QTH: "+data['qth'] : ''} <br/>
		</span>
	`;
/*
	/////////////////////////////////////////////
	var box = document.querySelector('#bio_container');
	box.value = '';
	box.style.display = '';
	var img = document.querySelector('#bio_container_img');
	img.src = '';
	img.style.display = '';
	var data = u['bio'];
	data['stats'] ||= {};
	var otherCalls = data['other_callsigns'] || [];
	img.src = `https://www.gravatar.com/avatar/${data['gravatar']}?s=100&d=identicon`;
	box.value += data['callsign'] + "       " + otherCalls.join(', ') + "\n";
	box.value += data['name'] + "\n";
//	box.value += data['qth'] + "\n";
//	box.value += data['stats']['awards'] + ' awards ' + data['stats']['endorsements'] + ' endorsements' + "\n";
	var hunter = data['stats']['hunter'] || {};
	box.value += 'Hunted ' + hunter['parks'] + ' parks ' + hunter['qsos'] + ' qsos' + "\n";
	var attempts = data['stats']['attempts'] || {};
	box.value += attempts['activations'] + ' Activations ' + attempts['parks'] + ' parks ' + attempts['qsos'] + ' qsos' + "\n";
*/
}

function lookupOpHunted (call) {
	if( ! OPTIONS.enableOpProfileInfo ){
		updateBio(OPS_HUNTED[call]);
		return;
	}
	if( ! call ){
		// not sure how this happens, but it seems to ... so bail, just in case...
		return;
	}
	if( OPS_HUNTED[call] && OPS_HUNTED[call]['bio'] ){
		if( youngerThan( OPS_HUNTED[call].updated, 20 ) ){
			updateBio(OPS_HUNTED[call]);
			return;
		}
	}
	OPS_HUNTED[call] ||= { "ct": 0, "updated": Date.now(), "bio":{} };
	OPS_HUNTED[call]['updated'] = Date.now();
	var searchCall = call.replace( /\/.*/, '' );
	return _fetch('https://api.pota.app/profile/'+searchCall, POTA_API_OPTS)
	    .then(response => response.json())
	    .then(data => {
		if( ! (data && data['callsign'] )){
			return;
		}
		var primaryCall = data['callsign'];
		var otherCalls = data['other_callsigns'] || [];
		OPS_HUNTED[primaryCall] = { "ct": 0, "updated": Date.now(), "bio": data };
		for (let c of otherCalls) {
		    OPS_HUNTED[c] = OPS_HUNTED[primaryCall];
		}
		updateBio(OPS_HUNTED[primaryCall]);
		// Do not crawl /user/logbook here. pota.app's Op-to-Op chip
		// already shows hunter/activator QSO counts; the old per-call
		// page walk was unused (badge display:none) and expensive.
	    });
}

function lookupParkHunted (park_num) {
	if( ! OPTIONS.enableOpProfileInfo ){
		updateParkBio(PARK_INFO[park_num]);
		return;
	}
	if( ! park_num ){
		// not sure how this happens, but it seems to ... so bail, just in case...
		return;
	}
	if( PARK_INFO[park_num] && PARK_INFO[park_num]['info'] ){
		if( youngerThan( PARK_INFO[park_num].updated, 20 ) ){
			updateParkBio(PARK_INFO[park_num]);
			return;
		}
	}
	PARK_INFO[park_num] ||= { "ct": 0, "updated": Date.now(), "info":{}, "stats":{} };
	PARK_INFO[park_num]['updated'] = Date.now();
	return _fetch('https://api.pota.app/park/'+park_num, POTA_API_OPTS)
	// https://api.pota.app/park/K-6532
	// https://api.pota.app/park/stats/K-6532
	    .then(response => response.json())
	    .then(data => {
		if( ! (data && data['reference'] )){
			return;
		}
		var park_ref = data['reference'];
		//
		// https://parksontheair.com/pota-awards/#advanced-awards
		// https://docs.pota.app/assets/images/shift_map.png
		var lng = data['longitude'];
		data['lateshift_start' ] = ( Math.round(18 - lng / 15.0)      % 24).toString().padStart(2,'0').padEnd(4,'0');
		data['lateshift_end'   ] = ((Math.round(18 - lng / 15.0) + 8) % 24).toString().padStart(2,'0').padEnd(4,'0');
		data['earlyshift_start'] = ( Math.round(26 - lng / 15.0)      % 24).toString().padStart(2,'0').padEnd(4,'0');
		data['earlyshift_end'  ] = ((Math.round(26 - lng / 15.0) + 6) % 24).toString().padStart(2,'0').padEnd(4,'0');
		//
		PARK_INFO[park_ref] = { "ct": 0, "updated": Date.now(), "info": data, "stats":{} };
		return _fetch('https://api.pota.app/park/stats/'+park_num, POTA_API_OPTS)
		    .then(response => response.json())
		    .then(data => {
			if( ! (data && data['reference'] )){
				return;
			}
			var park_ref = data['reference'];
			PARK_INFO[park_ref]['stats'] = data;
			    // write PARK_INFO to cache.
			sendChromeMessage("set__PARK_INFO",  PARK_INFO );
			updateParkBio( PARK_INFO[park_ref] );
		    });
	    });
}


function updateMyAwardsStat ( k, currentNum, nextLevel ){
	var box = document.querySelector('#myawards_container');
	if( ! box ){
		return false;
	}
	var numerator   = box.querySelector(`#${k}_hunted`);
	var denominator = box.querySelector(`#${k}_next`);
	if( ! numerator || ! denominator ){
		return false;
	}
	if( currentNum == null || currentNum === '' || typeof currentNum === 'undefined' ){
		return false;
	}
	numerator.innerHTML = currentNum;
	denominator.innerHTML = (nextLevel == null || typeof nextLevel === 'undefined') ? '' : nextLevel;
	if( nextLevel - currentNum <= 10 ){
	  Object.assign( numerator.style, {
		"background-color": "orange",
		"padding": "5px",
		"font-weight": "bold",
		"border-radius": "8px",
		"font-size": "larger",
	  });
	}
	return true;
}

function paintEarnedAwardsDelta(delta){
	var box = document.querySelector('#earned_container');
	if( ! box ){
		return;
	}
	if( isPoisonedEarnedList(delta) ){
		box.innerHTML = '';
		box.style.display = 'none';
		return;
	}
	var lines = (delta || []).map(formatEarnedAwardLine).filter(Boolean);
	if( ! lines.length ){
		box.innerHTML = '';
		box.style.display = 'none';
		return;
	}
	box.innerHTML = 'New awards earned!!<br/> <ul>' +
		lines.sort().reverse().map(function(t){ return '<li>' + t + '</li>'; }).join('\n') +
		'</ul>';
	box.style.display = '';
}

var WAS_HUNTED = null;
var PARKS_HUNTED = null;
var ACTIVATIONS = null;
var N1CC_HUNTED = null;
var LOCATIONS_HUNTED = null;
//
var MYAWARDS_PARKS = null;
var MYAWARDS_LATESHIFT = null;
var MYAWARDS_EARNED = {};
var SPACEWX = {};
function paintSpaceWx(){
  var box = document.querySelector('#spacewx_container');
  if( ! box ){
    return;
  }
  if( OPTIONS && OPTIONS.enableSpaceWX ){
    box.style.display = '';
  }
  var flux = latestNoaaFlux(SPACEWX['flux']);
  var ka = parseNoaaKpRecord(SPACEWX['k_a']);
  var sfi = box.querySelector('#sfi');
  var kEl = box.querySelector('#k_index');
  var aEl = box.querySelector('#a_index');
  if( sfi ){
    sfi.textContent = flux ? formatNoaaFlux(flux) : (sfi.textContent || '');
    if( flux ){
      sfi.setAttribute('title', flux.time_tag || '');
    }
  }
  if( ka ){
    if( kEl ){
      kEl.textContent = ka.kp != null && ka.kp !== '' ? String(ka.kp) : '';
      kEl.setAttribute('title', ka.time_tag || '');
    }
    if( aEl ){
      aEl.textContent = ka.a_running != null && ka.a_running !== '' ? String(ka.a_running) : '';
      aEl.setAttribute('title', ka.time_tag || '');
    }
  }
}
function noaaJson(url, onData){
  chrome.runtime.sendMessage({ message: 'fetch_json', url: url }, function(response){
    if( chrome.runtime.lastError ){
      _fetch(url)
	.then(function(r){ return r && r.json ? r.json() : null; })
	.then(onData)
	.catch(function(err){ console.log('POTAPlus NOAA:', err); onData(null); });
      return;
    }
    if( response && response.message === 'success' ){
      onData(response.payload);
      return;
    }
    _fetch(url)
      .then(function(r){ return r && r.json ? r.json() : null; })
      .then(onData)
      .catch(function(err){ console.log('POTAPlus NOAA:', err); onData(null); });
  });
}
function fetchSpaceWx(){
  if( OPTIONS && OPTIONS.enableSpaceWX === false ){
    return;
  }
  if( window.__POTAPLUS_WX_FETCHED__ ){
    paintSpaceWx();
    return;
  }
  window.__POTAPLUS_WX_FETCHED__ = true;
  chrome.runtime.sendMessage({ message: "get__SPACEWX_FLUX_cache" }, response => {
    if( OPTIONS && OPTIONS.enableSpaceWX === false ){
	return;
    }
    var cache = response && response.message === 'success' ? response.payload : null;
    var cachedFlux = cache && cache.data && cache.updated && youngerThan(cache.updated,12)
	? latestNoaaFlux(cache.data) : null;
    if( cachedFlux && cachedFlux.flux != null ){
	SPACEWX['flux'] = cachedFlux;
	paintSpaceWx();
    } else {
    noaaJson('https://services.swpc.noaa.gov/json/f107_cm_flux.json', function(data){
	    if( ! data ){ return; }
	    SPACEWX['flux'] = latestNoaaFlux(data);
	    sendChromeMessage("set__SPACEWX_FLUX_cache",  {updated:Date.now(), data: SPACEWX['flux']}  );
	    paintSpaceWx();
    });
    }
  });
  chrome.runtime.sendMessage({ message: "get__SPACEWX_KA_cache" }, response => {
    if( OPTIONS && OPTIONS.enableSpaceWX === false ){
	return;
    }
    var cache = response && response.message === 'success' ? response.payload : null;
    var cachedKa = cache && cache.data && cache.updated && youngerThan(cache.updated,12)
	? parseNoaaKpRecord(cache.data) : null;
    if( cachedKa && (cachedKa.kp != null || cachedKa.a_running != null) ){
	SPACEWX['k_a'] = cachedKa;
	paintSpaceWx();
    } else {
    noaaJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', function(data){
	    if( ! data ){ return; }
	    var rec = parseNoaaKpRecord(data);
	    SPACEWX['k_a'] = rec;
	    sendChromeMessage("set__SPACEWX_KA_cache",  {updated:Date.now(), data: rec}  );
	    paintSpaceWx();
    });
    }
  });
}
function loadLoggedInHunterData(){
  if( ! MYCALL ){
    return;
  }
  if( ! TOKEN ){
    return;
  }
  if( window.__POTAPLUS_HUNTER_LOADED__ ){
    return;
  }
  if( ! OPTIONS ){
    setTimeout(loadLoggedInHunterData, 250);
    return;
  }
  window.__POTAPLUS_HUNTER_LOADED__ = true;
  if( HUNTER_CALLS ){
    HUNTER_CALLS[ MYCALL ] = Date.now();
    sendChromeMessage("set__HUNTER_CALLS",  HUNTER_CALLS  );
  }
  ////////
  chrome.runtime.sendMessage({ message: "get__LOCATIONS_HUNTED_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
      if( cache && cache.data && cache.updated && youngerThan(cache.updated,20)){
	LOCATIONS_HUNTED = cache.data;	// use cached
	try { pokeMainTable(); } catch (e) {}
	return;
      }
    }
    if( ! OPTIONS.enableNeededLocations ){
	LOCATIONS_HUNTED = [];  // set to non-null so main handler thinks it is loaded. 
	return;
    }
    // refresh from pota.app API
    _fetch('https://api.pota.app/user/award/progress/hunter/allrefs', POTA_API_OPTS)
    .then(response => response.json())
    .then(data => {
	    var list = asUserList(data);
	    if( ! list ){ return; }
	    LOCATIONS_HUNTED = list;
	    sendChromeMessage("set__LOCATIONS_HUNTED_cache",  {updated:Date.now(), data:LOCATIONS_HUNTED}  );
	    pokeMainTable(); // touch, to trigger initial update
	    //console.log("Locations CT", LOCATIONS_HUNTED.length);
	    //console.log("Locations MEM SIZE", JSON.stringify(LOCATIONS_HUNTED).length);
	    //console.log(LOCATIONS_HUNTED[0]);
/*
  {
 			locationDesc: "US-DC"
			locationId: 9
			locationName: "District Of Columbia"
			numParksActivated: 9
			numParksAvailable: 30
			toGo: 21
  },
*/
    }); // fetch
  });  // get__LOCATIONS_HUNTED_cache
  ////////
  chrome.runtime.sendMessage({ message: "get__WAS_HUNTED_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
      if( cache && cache.data && cache.updated && youngerThan(cache.updated,20)){
	WAS_HUNTED = cache.data;	// use cached
	try { pokeMainTable(); } catch (e) {}
	return;
      }
    }
    if( ! OPTIONS.enableNeededWAS ){
	WAS_HUNTED = [];  // set to non-null so main handler thinks it is loaded. 
	return;
    }
    // refresh from pota.app API
    _fetch('https://api.pota.app/user/award/progress/hunter/usstates', POTA_API_OPTS)
    .then(response => response.json())
    .then(data => {
	    var list = asUserList(data);
	    if( ! list ){ return; }
	    WAS_HUNTED = list;
	    sendChromeMessage("set__WAS_HUNTED_cache",  {updated:Date.now(), data:WAS_HUNTED}  );
	    pokeMainTable(); // touch, to trigger initial update
	    //console.log("WAS CT", WAS_HUNTED.length);
	    //console.log("WAS MEM SIZE", JSON.stringify(WAS_HUNTED).length);
	    //console.log(WAS_HUNTED[0]);
/*
  {
    "locationId": 3,
    "locationDesc": "US-AL",
    "locationName": "Alabama"
  },
*/
    }); // fetch
  });  // get__WAS_HUNTED_cache
  ////////
  chrome.runtime.sendMessage({ message: "get__PARKS_HUNTED_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
      if( cache && cache.data && cache.updated && youngerThan(cache.updated,20)){
	PARKS_HUNTED = cache.data;	// use cached
	try { pokeMainTable(); } catch (e) {}
	return;
      }
    }
    if( ! OPTIONS.enableNeededParks && ! OPTIONS.enableNeededLocations ){
	PARKS_HUNTED = [];  // set to non-null so main handler thinks it is loaded. 
	return;
    }
    // refresh from pota.app API
    _fetch('https://api.pota.app/user/stats/hunter/park', POTA_API_OPTS)
    .then(response => response.json())
    .then(data => {
	    var list = asUserList(data);
	    if( ! list ){ return; }
	    PARKS_HUNTED = list;
	    sendChromeMessage("set__PARKS_HUNTED_cache",  {updated:Date.now(), data:PARKS_HUNTED}  );
	    pokeMainTable(); // touch, to trigger initial update
	    //console.log("PARKS CT", PARKS_HUNTED.length);
	    //console.log("PARKS MEM SIZE", JSON.stringify(PARKS_HUNTED).length);
	    //console.log(PARKS_HUNTED[0]);
/*
  {
    "entity": "Canada",
    "location": "New Brunswick",
    "short": "CA-NB",
    "reference": "VE-0786",
    "park": "Meredith Houseworth Memorial Seashore Natural Area",
    "first": "2020-07-18T00:31:10",
    "qsos": 2
  },
*/
    }); // fetch
  });  // get__PARKS_HUNTED_cache
  ////////
  ////////
  chrome.runtime.sendMessage({ message: "get__MYAWARDS_PARKS_cache" }, response => {
    if( ! OPTIONS.enableMyAwards ){
	return;
    }
    if (response && response.message === 'success') {
      var cache = response.payload;
      if( cache && cache.data && cache.updated && youngerThan(cache.updated,20)){
	MYAWARDS_PARKS = (typeof cache.data === 'string') ? (function(){ try { return JSON.parse(cache.data); } catch(e){ return null; } })() : cache.data;
	var cachedParks = parseAwardProgress(MYAWARDS_PARKS, ['numParks', 'parks', 'current', 'hunted', 'count'], ['nextAwardLevel', 'nextLevel', 'next', 'target']);
	if( cachedParks ){
	  MYAWARDS_PARKS = { numParks: cachedParks.current, nextAwardLevel: cachedParks.next, completedPct: MYAWARDS_PARKS && MYAWARDS_PARKS.completedPct };
	  updateMyAwardsStat( "parks", MYAWARDS_PARKS['numParks'], MYAWARDS_PARKS['nextAwardLevel'] );
	  return;
	}
      }
    }
    _fetch('https://api.pota.app/user/award/progress/hunter/parks', POTA_API_OPTS) // refresh from pota.app API
    .then(response => response.json())
    .then(data => {
	    var progress = parseAwardProgress(data, ['numParks', 'parks', 'current', 'hunted', 'count'], ['nextAwardLevel', 'nextLevel', 'next', 'target']);
	    if( ! progress ){
	      return;
	    }
	    MYAWARDS_PARKS = { numParks: progress.current, nextAwardLevel: progress.next, completedPct: data && data.completedPct };
	    sendChromeMessage("set__MYAWARDS_PARKS_cache",  {updated:Date.now(), data:MYAWARDS_PARKS}  );
	    updateMyAwardsStat( "parks", MYAWARDS_PARKS['numParks'], MYAWARDS_PARKS['nextAwardLevel'] );
    }); // fetch
  });  // get__MYAWARDS_PARKS_cache
  ////////
  chrome.runtime.sendMessage({ message: "get__MYAWARDS_LATESHIFT_cache" }, response => {
    if( ! OPTIONS.enableMyAwards ){
	return;
    }
    if (response && response.message === 'success') {
      var cache = response.payload;
      if( cache && cache.data && cache.updated && youngerThan(cache.updated,20)){
	MYAWARDS_LATESHIFT = (typeof cache.data === 'string') ? (function(){ try { return JSON.parse(cache.data); } catch(e){ return null; } })() : cache.data;
	var cachedShift = parseAwardProgress(MYAWARDS_LATESHIFT, ['contacts', 'current', 'count', 'qsos'], ['nextAwardLevel', 'nextLevel', 'next', 'target']);
	if( cachedShift ){
	  MYAWARDS_LATESHIFT = { contacts: cachedShift.current, nextAwardLevel: cachedShift.next, completedPct: MYAWARDS_LATESHIFT && MYAWARDS_LATESHIFT.completedPct };
	  updateMyAwardsStat( "lateshift", MYAWARDS_LATESHIFT['contacts'], MYAWARDS_LATESHIFT['nextAwardLevel'] );
	  return;
	}
      }
    }
    _fetch('https://api.pota.app/user/award/progress/hunter/lateshift', POTA_API_OPTS) // refresh from pota.app API
    .then(response => response.json())
    .then(data => {
	    var progress = parseAwardProgress(data, ['contacts', 'current', 'count', 'qsos'], ['nextAwardLevel', 'nextLevel', 'next', 'target']);
	    if( ! progress ){
	      return;
	    }
	    MYAWARDS_LATESHIFT = { contacts: progress.current, nextAwardLevel: progress.next, completedPct: data && data.completedPct };
	    sendChromeMessage("set__MYAWARDS_LATESHIFT_cache",  {updated:Date.now(), data:MYAWARDS_LATESHIFT}  );
	    updateMyAwardsStat( "lateshift", MYAWARDS_LATESHIFT['contacts'], MYAWARDS_LATESHIFT['nextAwardLevel'] );
    }); // fetch
  });  // get__MYAWARDS_LATESHIFT_cache
  ////////
  chrome.runtime.sendMessage({ message: "get__MYAWARDS_EARNED_cache" }, response => {
    if( ! OPTIONS.enableMyAwards ){
	return;
    }
    if (response && response.message === 'success') {
      var cache = response.payload;
      MYAWARDS_EARNED = parseEarnedCachePayload(cache);
//DEBUG>>>//
//MYAWARDS_EARNED['prev'] = MYAWARDS_EARNED['curr'].slice(1,35);
//MYAWARDS_EARNED['delta'] = MYAWARDS_EARNED['curr'].filter(x => MYAWARDS_EARNED['prev'].indexOf(x) === -1);
//DEBUG<<<//
//console.log('MYAWARDS_EARNED', MYAWARDS_EARNED);
      if( cache && cache.data && cache.updated && youngerThan(cache.updated,20)
	    && MYAWARDS_EARNED && Array.isArray(MYAWARDS_EARNED.curr) && MYAWARDS_EARNED.curr.length ){
	    if( MYAWARDS_EARNED['delta'] && MYAWARDS_EARNED['delta'].length && MYAWARDS_EARNED['prev'] && MYAWARDS_EARNED['prev'].length ){
		paintEarnedAwardsDelta(MYAWARDS_EARNED['delta']);
	    }
	    return;
      }
    }
    _fetch('https://api.pota.app/user/award/earned', POTA_API_OPTS) // refresh from pota.app API
    .then(response => response.json())
    .then(data => {
	    var curr = parseEarnedAwardsPayload(data);
	    if( ! curr.length && isPotaAuthError(data) ){
	      window.__POTAPLUS_HUNTER_LOADED__ = false;
	      return;
	    }
	    MYAWARDS_EARNED['prev'] = (MYAWARDS_EARNED['curr'] || []).map( (x) => JSON.stringify(x) );
	    MYAWARDS_EARNED['curr'] = curr;
	    MYAWARDS_EARNED['delta'] = MYAWARDS_EARNED['curr'].filter(x => MYAWARDS_EARNED['prev'].indexOf( JSON.stringify(x) ) === -1);
	    sendChromeMessage( "set__MYAWARDS_EARNED_cache",  {updated:Date.now(), data:JSON.stringify(MYAWARDS_EARNED)} );
	    if( MYAWARDS_EARNED['delta'] && MYAWARDS_EARNED['delta'].length && MYAWARDS_EARNED['prev'].length ){
		paintEarnedAwardsDelta(MYAWARDS_EARNED['delta']);
	    }
    }); // fetch
  });  // get__MYAWARDS_EARNED_cache
  fetchSpaceWx();
  ////////
  chrome.runtime.sendMessage({ message: "get__ACTIVATIONS_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
      if( cache && cache.data && cache.updated && youngerThan(cache.updated,20)){
	ACTIVATIONS = cache.data;	// use cached
	return;
      }
    }
    if( ! OPTIONS.enableNeededParks && ! OPTIONS.enableNeededLocations ){
	ACTIVATIONS = [];  // set to non-null so main handler thinks it is loaded. 
	return;
    }
    // refresh from pota.app API
    _fetch('https://api.pota.app/activation', POTA_API_OPTS)
    .then(response => response.json())
    .then(data => {
	    var list = asUserList(data);
	    if( ! list ){ return; }
	    ACTIVATIONS = list;
	    sendChromeMessage("set__ACTIVATIONS_cache",  {updated:Date.now(), data:ACTIVATIONS}  );
	    pokeMainTable(); // touch, to trigger initial update
/*
 [
 {
activator: "KN4ZMA"
activityEnd: null
activityStart: null
comments: "In BWCA, 5W CW, hoping to activate once or twice."
endDate: "2022-07-11"
endTime: "23:00"
frequencies: "7040"
locationDesc: "US-MN"
name: "Superior National Forest"
reference: "K-4491"
scheduledActivitiesId: 40958
schedulerUserId: 8938
startDate: "2022-07-02"
startTime: "01:00"
  },
  ...
  ]
*/
    }); // fetch
  });  // get__ACTIVATIONS_cache
  ////////
  ////////
} // loadLoggedInHunterData
loadLoggedInHunterData();

function setBackgroundForRow(btn, bgcolor) {
	if( ! btn ){
		return;
	}
	   var outer = btn.closest('tr[data-spot-activator], [data-spot-activator], .spot-card, tr, div.v-card');
	   if(outer){
		outer.style.setProperty( 'background-color', bgcolor, (bgcolor?'important':'') );
	   }
}

function setBackgroundForCallsign(callsign, bgcolor) {
	if(!callsign){
		return;
	}
	var search = '[data-callsign="' + callsign + '"]';
	var btn = document.querySelector(search);
	if(btn){
//	   btn.style.backgroundColor = bgcolor;
	   var outer = btn.closest('tr[data-spot-activator], [data-spot-activator], .spot-card, tr, div.v-card');
	   if(outer){
		outer.style.setProperty( 'background-color', bgcolor, (bgcolor?'important':'') );
		var btn2 = outer.querySelector('[data-marker="QSL_BTN"]');
		if(btn2){
//			btn2.style.setProperty('background-color', bgcolor, 'important');
		}
	   }
	}
}

function setCurrentCallsignBackground(bgcolor) {
    chrome.runtime.sendMessage({ 
        message: "get__selectedcall"
      }, response => {
      if (response && response.message === 'success') {
	var callsign = response.payload;
	setBackgroundForCallsign(callsign, bgcolor);
      }
    });
}

var selectedcall = '';  // TODO use ARRAY
var selectedcall2 = '';
var selectedcall3 = '';

chrome.runtime.sendMessage({ 
        message: "get__selectedcall"
      }, response => {
      if (response && response.message === 'success') {
	selectedcall = response.payload;
      }
});

var scan_call = '0E0';
var scanning = 0;
var SCANIDS = [];
function startScan(delta){
//  stopScan();
  var scanId = Math.random();
  scanning = scanId;
//  SCANIDS[scanId] = true;
  return scanNext(delta, scanId);
}
function stopScan(){
  scanning = 0;
//	SCANIDS = [];
//      Object.keys( SCANIDS ).forEach( x => { SCANIDS[x] = false } );
}
function scanNext(delta, scanId){   // delta=-1 for scan up, or +1 (default) for scan down
	if( scanning != scanId ){
		return;
	}
	delta ||= 1;
        var btns = Array.from( document.querySelectorAll('input#btn_qsy') );
	var i = btns.findIndex( x => x.getAttribute('data-callsign') === scan_call );
	i = (i+delta + btns.length) % btns.length;
	if(!btns[i]){return;}
	scan_call = btns[i].getAttribute('data-callsign');
	var spotKey = btns[i].getAttribute('data-spotKey');
	if( TOGGLES[spotKey] == 2 ){
		// skip if spot is toggled ~ to "negative"
		return scanNext(delta, scanId);
	}
	var p = btns[i];
	while( p = p.parentElement ){
	  if( p.style.display == 'none' ){
		// skip if spot is hidden by extra hide-spots filtering
		return scanNext(delta, scanId);
	  }
	}
	//console.log('scan qsy to ' + scan_call);
	btns[i].click();
	setTimeout(() => { scanNext(delta, scanId); }, document.getElementById('scan_dwell').value );
}


    var scanHTML = `
	&nbsp;
	<span id="scan_container"
	  class="ma-2 v-btn v-btn--is-elevated v-btn--has-bg theme--light v-size--default secondary"
	  style="
		display:none;
		__background-color: greenyellow;
		border-radius: 5px;
		padding: 6px;
		border: 1px solid grey;
		white-space: nowrap;
		"
	  >
      <input id="btn_scan" type=button value="SCAN" />
	<select id="scan_dwell" style="
		padding: 3px;
		padding-bottom: 0px;
		margin-left: 3px;
		background-color: lightgray;
		border-radius: 5px;
		border: 1px solid gray;
		__appearance: auto;
		font-size: smaller;
	    ">
	<option value="3000">3s</option>
	<option value="5000" SELECTED>5s</option>
	<option value="8000">8s</option>
	<option value="13000">13s</option>
	<option value="21000">21s</option>
	<option value="34000">34s</option>
	<option value="55000">55s</option>
	</select>
	</span>
    `;
    function getWidgetHost() {
      placeToolbar();
      var dest = findSpotsWidgetAnchor();
      var existing = document.getElementById('potaplus_widgets');
      if (existing) {
        if (isLoosePotaPlusParent(existing.parentElement) || dest.mode === 'after-panel' || dest.mode === 'after-filters') {
          attachPotaPlusHost(existing, dest);
        }
        return existing;
      }
      var host = document.createElement('div');
      host.id = 'potaplus_widgets';
      host.style.width = '100%';
      host.style.display = 'flex';
      host.style.flexWrap = 'wrap';
      host.style.alignItems = 'center';
      host.style.gap = '6px';
      attachPotaPlusHost(host, dest);
      return host;
    }
    function toolbarParent() {
      placeToolbar();
      var link = document.querySelector('#upgrade_link');
      return (link && link.parentElement) || document.getElementById('potaplus_toolbar') || getWidgetHost();
    }
    var scanNode = document.createElement('span');
    scanNode.innerHTML= scanHTML;
    toolbarParent().appendChild(scanNode);

      var myAwardsNode = document.createElement('div');
      myAwardsNode.setAttribute('id','myawards_container');
      myAwardsNode.classList.add("col-12", "col");
      myAwardsNode.style.display	= "none";
      myAwardsNode.style.border		= "2px solid";
      myAwardsNode.style.borderRadius	= "5px";
      myAwardsNode.style.maxWidth	= "fit-content";
      myAwardsNode.style.padding	= "5px";
      myAwardsNode.style.marginBottom	= "5px";
      myAwardsNode.innerHTML = `
	Parks Hunted: <span id="parks_hunted"></span> / <span id="parks_next"></span>
	&nbsp;&nbsp;&nbsp;
	Late Shifts Hunted: <span id="lateshift_hunted"></span> / <span id="lateshift_next"></span>
	<br/>
      `;
      getWidgetHost().appendChild(myAwardsNode);

      var wxWidgetNode = document.createElement('div');
      wxWidgetNode.setAttribute('id','widget_rigref_container');
      wxWidgetNode.classList.add("col-12", "col");
      wxWidgetNode.style.display	= "none";
      wxWidgetNode.style.border		= "2px solid";
      wxWidgetNode.style.borderRadius	= "5px";
      wxWidgetNode.style.maxWidth	= "fit-content";
      wxWidgetNode.style.padding	= "5px";
      wxWidgetNode.style.marginBottom	= "5px";
      wxWidgetNode.style.marginLeft	= "10px";
      wxWidgetNode.innerHTML = `
	<a href="https://rigreference.com/solar" target="_blank"><img
		src="https://rigreference.com/solar/img/wide"
		border="0"
		style="height: 30px; vertical-align: middle;"
		onmouseover="this.style.height = '150px'"
		x__onmouseout="this.style.height = '30px'"
		onmouseout=" setTimeout(() => { this.style.height = '30px'; }, 1000 ); "
	></a>
      `;
      getWidgetHost().appendChild(wxWidgetNode);

      var spaceWxNode = document.createElement('div');
      spaceWxNode.setAttribute('id','spacewx_container');
      spaceWxNode.classList.add("col-12", "col");
      spaceWxNode.style.display	= "none";
      spaceWxNode.style.border		= "2px solid";
      spaceWxNode.style.borderRadius	= "5px";
      spaceWxNode.style.maxWidth	= "fit-content";
      spaceWxNode.style.padding	= "5px";
      spaceWxNode.style.marginBottom	= "5px";
      spaceWxNode.style.marginLeft	= "10px";
      spaceWxNode.innerHTML = `
	SFI=<span id="sfi"></span>
	&nbsp;
	A=<span id="a_index"></span>
	&nbsp;
	K=<span id="k_index"></span>
      `;
      getWidgetHost().appendChild(spaceWxNode);
      paintSpaceWx();
      fetchSpaceWx();

      var greyLineNode = document.createElement('div');
      greyLineNode.setAttribute('id','greyline_container');
      greyLineNode.classList.add("col-12", "col");
      greyLineNode.style.display	= "none";
      greyLineNode.style.borderRadius	= "5px";
      greyLineNode.style.maxWidth	= "fit-content";
      greyLineNode.style.padding	= "0px";
      greyLineNode.style.marginLeft	= "10px";
      greyLineNode.innerHTML = `
	<a target="_blank" href="https://www.timeanddate.com/worldclock/sunearth.html"><img style="height: 40px" src="https://www.timeanddate.com/scripts/sunmap.php" /></a>
      `;
      getWidgetHost().appendChild(greyLineNode);

      var awardsEarnedNode = document.createElement('span');
      awardsEarnedNode.setAttribute('id','earned_container');
      awardsEarnedNode.classList.add("col-12", "col");
      awardsEarnedNode.style.display	= "none";
      awardsEarnedNode.style.border		= "2px solid";
      awardsEarnedNode.style.borderRadius	= "5px";
      awardsEarnedNode.style.maxWidth	= "fit-content";
      awardsEarnedNode.style.padding	= "5px";
      awardsEarnedNode.style.marginBottom	= "5px";
      awardsEarnedNode.innerHTML = '';
      getWidgetHost().appendChild(awardsEarnedNode);


    var bioNode = document.createElement('div');
    bioNode.setAttribute('id','bio_container_');
    bioNode.classList.add("col-3", "col");
//    bioNode.innerHTML = `<img id="bio_container_img" style="float:left"><textarea id="bio_container" style="display:none; height:100px; font-size: smaller; font-family: monospace; margin-left:10px; white-space:nowrap; width:100ch"></textarea>`;
//    getWidgetHost().appendChild(bioNode);

    var parkMapNode = document.createElement('div');
    parkMapNode.setAttribute('id','parkmap_container_');
    parkMapNode.classList.add("col-3", "col");

    var parkBioNode = document.createElement('div');
    parkBioNode.setAttribute('id','parkbio_container_');
    parkBioNode.classList.add("col-3", "col");
//    getWidgetHost().appendChild(parkBioNode);

    var spotBioNode = document.createElement('div');
    spotBioNode.setAttribute('id','spotbio_container_');
    spotBioNode.classList.add("col-3", "col");

    var activationBioNode = document.createElement('div');
    activationBioNode.setAttribute('id','activationbio_container_');
    activationBioNode.classList.add("col-12", "col");

    var infoPanesNode = document.createElement('div');
//    infoPanesNode.classList.add("row");
    infoPanesNode.style.width = "100%";
    //
    infoPanesNode.appendChild(bioNode);
    infoPanesNode.appendChild(parkBioNode);
    infoPanesNode.appendChild(parkMapNode);
    infoPanesNode.appendChild(spotBioNode);
    //
    infoPanesNode.appendChild(activationBioNode);
    //
    infoPanesNode.innerHTML = `
	    <div class="row">
	    	<div class="col col-3" id="bio_container_title"></div>
	    	<div class="col col-9" id="parkbio_container_title"></div>
	    </div>
	    <div class="row" style="margin-top: -10px">
	    	<div class="col col-3 col-md-3 col-sm-6 col-xs-12" id="bio_container_"></div>
	    	<div class="col col-3 col-md-3 col-sm-6 col-xs-12" id="parkbio_container_"></div>
	    	<div class="col col-3 col-md-3 col-sm-6 col-xs-12" id="parkmap_container_"></div>
	    	<div class="col col-3 col-md-3 col-sm-6 col-xs-12" id="spotbio_container_"></div>
	    </div>
	    <div class="row">
	    	<div class="col col-12" id="activationbio_container_"></div>
	    </div>
    `;
    getWidgetHost().appendChild(infoPanesNode);

    var logNode = document.createElement('div');
    logNode.setAttribute('id','log_container_');
    logNode.classList.add("col-12", "col");
    logNode.innerHTML = `<textarea id="log_container" style="display:none; width:100%; height:100%; font-size: smaller; font-family: monospace;"></textarea>`;
    logNode.style.width="100%";
    logNode.style.height="300px";
    logNode.style.border="1px solid black";
    logNode.style.display="none";
    getWidgetHost().appendChild(logNode);


    var filterOptionsNode = document.createElement('div');
    filterOptionsNode.setAttribute('id','filter_container');
    filterOptionsNode.classList.add("col-12", "col");
    getWidgetHost().appendChild(filterOptionsNode);

    var huntKeysNode = document.createElement('div');
    huntKeysNode.setAttribute('id','potaplus_hunt_keys');
    huntKeysNode.style.display = 'none';
    getWidgetHost().appendChild(huntKeysNode);

    var scanBtn = document.getElementById('btn_scan');
    if (scanBtn) {
    scanBtn.addEventListener('click', (e) => {
	var x = document.getElementById('scan_container');
	// x=e.target
	if(scanning){
//		console.log('SCANNING OFF');
		//x.style.backgroundColor = 'greenyellow';
		x.classList.remove("error");
		x.classList.add("secondary");
		scanning = 0;
	}else{
//		console.log('SCANNING ON');
		//x.style.backgroundColor = 'red';
		x.classList.remove("secondary");
		x.classList.add("error");
		startScan(); // scanning = 1; scanNext();
	}
    });
    }


function createDiv( classes ){
  var _e = document.createElement('div');
  Array.from( classes ).forEach( (c) => {
    _e.classList.add(c);
  } );
  return _e;
}
function buildInputDiv(xs,sm){
  var div = createDiv(['flex', xs||'xs12', sm||'sm6'])
	.appendChild( createDiv( ["v-input","v-input--is-label-active","v-input--is-dirty",THEMECLASS,"v-text-field","v-text-field--is-booted"] ) )
	.appendChild( createDiv(["v-input__control"]) )
	.appendChild( createDiv(["v-input__slot"]) )
	.appendChild( createDiv(["v-text-field__slot"]) )
	;
  return div;
}

function RST_ctrlNum(event) {
  if (event.ctrlKey && event.key.match(/^[0-9]$/) ){
    event.target.value = event.target.getAttribute('data-defaultrst').replace(/(.).(.?)/, "$1" + event.key + "$2");
    event.preventDefault();
  }
}

function toADIF(k,v){
  return "<"+k+":"+v.length+">"+v;
}

function submitLogEntry( fetch_url ){
//  console.log(" FETCH " , fetch_url);
  if( OPTIONS.loggingConfig.method == 'qrz' ){
	// we expect here that fetch_url is just a query string
	let searchParams = new URLSearchParams(fetch_url);
	var adif = Array.from( searchParams.entries() ).map( entry => toADIF(entry[0], entry[1]) ).join('')
	  + '<eor>';
//	  console.log("ADIF:", adif);
	// https://www.qrz.com/docs/logbook/QRZLogbookAPI.html
	// https://logbook.qrz.com/apicheck
	_fetch( 'https://logbook.qrz.com/api', {
		method: 'POST',
		mode: 'no-cors',
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		body: "key="+encodeURIComponent(OPTIONS.loggingConfig.target_apikey || '')
			+ "&ACTION=INSERT"
			+ "&ADIF="+encodeURIComponent(adif)
	} )
	  // TODO -- this does not seem to get the response ... expecting something like "LOGID=733604667&COUNT=1&RESULT=OK"  or an error message.
	  .then(response => {console.log("BODY: ",response.body); return response.text() })
	  .then( function(text){ console.log("QRZ.com RESPONSE:"); console.log(text) } )
	  .catch(err => console.log("QRZ.com ERROR:", err))
	;

  }else{ // straight GET
	_fetch( fetch_url, { // mode: 'no-cors'
		} );
  }
}

function logBtnClick(e2, doReSpot){
	    var _url = e2.target.getAttribute('data-URL');
	    var call = e2.target.getAttribute('data-call');
	    var ping_url = e2.target.getAttribute('data-ping-URL');
	    // hack to trap the known error, so it does not create errant log entries.
	    var spotCallRoot = e2.target.closest('[data-potaplus-log-dialog]')
		|| e2.target.closest('[role="dialog"]')
		|| e2.target.closest('.v-overlay--active')
		|| e2.target.closest(".v-card")
		|| e2.target.closest("[class*='v-card']");
	    var ours = !!(e2.target.closest && e2.target.closest('[data-potaplus-log-dialog]'));
	    var spotCallEl = (!ours && spotCallRoot) ? Array.from( spotCallRoot.querySelectorAll('label, .v-label, .v-field-label') ).find( el => el.textContent.match(/Activator Callsign/i) ) : null;
	    var spotCall = spotCallEl && (spotCallEl.nextSibling && spotCallEl.nextSibling.value !== undefined ? spotCallEl.nextSibling.value : (spotCallEl.closest('.v-input, .v-field, div') && spotCallEl.closest('.v-input, .v-field, div').querySelector('input'))) ;
	    spotCall = (spotCall && spotCall.value) ? spotCall.value : (typeof spotCall === 'string' ? spotCall : '');
	    if( spotCall && call && spotCall != call ){
		alert(`ERROR -- Call mismatch [${spotCall} vs ${call}] -- refresh page before logging`);
		return;
	    }
	    if( ping_url ){
	setTimeout(() => {
	  fetch( ping_url, {} )
		.then(function(response) {
		  if ( !response.ok // || ! data.success
			){
			var s = `PING FAILED [${response.status}] ${response.statusText}`;
			_log(ping_url);
			_log(s);
			_log( JSON.stringify(response) );
			console.log(ping_url);
			console.log(s);
			console.log( JSON.stringify(response) );
			alert("ERROR -- QSO NOT LOGGED");
			var msg = "VERIFY THAT ham-apps-proxy.exe AND your logging app are RUNNING";
			document.querySelector('#label_update').innerHTML = `ERROR -- ${msg}`;
			document.querySelector('#label_update').style.display = '';
		  }
		  return response;
		});
	}, 1000 ); //setTimeout
	    }
	    //
	    var park_num = e2.target.getAttribute('data-park_num');
	    var park_region = e2.target.getAttribute('data-park_region');
	    var logCard = e2.target.closest('[data-potaplus-log-dialog]')
		|| e2.target.closest(".v-card")
		|| e2.target.closest("[class*='v-card']")
		|| e2.target.closest('[role="dialog"]')
		|| e2.target.closest('.v-overlay--active');
	    if( ! logCard ){
		alert('POTAPlus: could not find the log dialog. Refresh the page and try again.');
		return;
	    }
	    var RST_SENT = (logCard.querySelector("#RST_SENT") || {}).value || '';
	    var RST_RCVD = (logCard.querySelector("#RST_RCVD") || {}).value || '';
	    var OTHER_OPS = ((logCard.querySelector("#OTHER_OPS") || {}).value || '').split(/[^A-Z0-9\/]+/i).filter(s=>s).map(s=>s.toUpperCase().trim());
	    var OTHER_PARKS = [
		(logCard.querySelector("#PARKNUM2") || {}).value,
		(logCard.querySelector("#PARKNUM3") || {}).value,
		(logCard.querySelector("#PARKNUM4") || {}).value,
		(logCard.querySelector("#PARKNUM5") || {}).value,
	    ].filter(s=>s).map(s=>s.toUpperCase().trim());
//	    var secondHunter = logCard.querySelector("#SECONDHUNTER").value;
	    var ALL_PARKS = [park_num].concat(OTHER_PARKS);
	    var alsoOtherParks = OTHER_PARKS.length ? '{Also: ' + OTHER_PARKS.join(',') + '} ' : '';
	    var RX_PWR = (logCard.querySelector("#RX_PWR") || {}).value || '';
	    var activatorPwr = RX_PWR ? '{Pwr: ' + RX_PWR + 'W} ' : '';
	    TX_PWR = (logCard.querySelector("#TX_PWR") || {}).value || ''; // global
	    sendChromeMessage("set__TX_PWR",  TX_PWR  );
	    var info = PARK_INFO[park_num] && PARK_INFO[park_num]['info'] ? PARK_INFO[park_num]['info'] : {};
	    var now = new Date().toISOString().slice(11,13) + "00"; // HH00  in UTC
	    var shiftInfo =
			  hourBetween(now, info['lateshift_start' ], info['lateshift_end' ]) ? '{LateShift} '
			: hourBetween(now, info['earlyshift_start'], info['earlyshift_end']) ? '{EarlyShift} '
			: '';
	    var COMMENTS_obj = logCard.querySelector('#POTAPLUS_COMMENTS')
		|| findLabelInput(logCard, /^Comments/i)
		|| (function(){
		var lbl = Array.from( logCard.querySelectorAll("label, .v-label, .v-field-label") ).find(x => /^Comments/i.test((x.innerText||'').trim()) );
		return lbl ? (lbl.closest('div') || logCard).querySelector('input, textarea') : null;
	    })();
	    var COMMENTS = COMMENTS_obj ? COMMENTS_obj.value : '';
// TODO    var p = PARK_INFO[park_num]["info"]; // grid6  locationDesc
	    _url = _url; // replace
	    _url = _url.replaceAll('__RST_RCVD__', encodeLogParam(RST_RCVD) );
	    _url = _url.replaceAll('__RST_SENT__', encodeLogParam(RST_SENT) );
	    _url = _url.replaceAll('__TX_PWR__', encodeLogParam(TX_PWR) );
	    _url = _url.replaceAll('__RX_PWR__', encodeLogParam(RX_PWR) );
	    _url = _url.replaceAll('__COMMENTS__', encodeLogParam(activatorPwr + alsoOtherParks + shiftInfo + COMMENTS) );
	    // inject QSODATE/TIME_ON here (for loggers using ADIF format date/time), so it's log-click time, not open-dialog-time.
	    _url = _url.replaceAll('__DATE_YYYYMMDD__', new Date().toISOString().slice(0 ,10).replaceAll("-","") );
	    _url = _url.replaceAll('__DATE_YYYY_MM_DD__', new Date().toISOString().slice(0 ,10).replaceAll("-","/") );
	    _url = _url.replaceAll('__TIME_HHMMSS__',   new Date().toISOString().slice(11,19).replaceAll(":","") );
	    _url = _url.replaceAll('__TIME_HHMM__',     new Date().toISOString().slice(11,16) );
	    _url = _url.replaceAll('__LOG4OM_PARKS__', encodeLogParam(JSON.stringify(
		    ALL_PARKS.map(function(n){
			    return {"AC":"POTA", "R":n, "G":park_region, "SUB":[], "GRA":[]}
		    }) )) );
	    _url = _url.replaceAll('__PARK_NUMS__', encodeLogParam(ALL_PARKS.join(',')) );
	    var fetch_url = _url.replaceAll('__CALL__', call );
	    submitLogEntry( fetch_url );
//console.log(" FETCH " , fetch_url);
//	    fetch( fetch_url, { mode: 'no-cors' } );
	    OTHER_OPS.forEach( (op_call) => {
		fetch_url = _url.replaceAll('__CALL__', op_call );
	        submitLogEntry( fetch_url );
//console.log(" FETCH OTHER CALL " , fetch_url);
//		fetch( fetch_url, { mode: 'no-cors' } );
	    } );
	    var spotComment = ""
		    	+ '['
			+ RST_SENT
			+ (OPTIONS.loggingConfig && OPTIONS.loggingConfig.homeQTH ? " " + OPTIONS.loggingConfig.homeQTH : '')
			+ '] '
			+ activatorPwr
			+ alsoOtherParks
		    	+ (OTHER_OPS.length   ? '{With: ' + OTHER_OPS.join(',')   + '} ' : '')
			+ COMMENTS
		    ;
	    if( doReSpot ){
		postPotaSpot({
		  call: call,
		  freq: e2.target.getAttribute('data-freq'),
		  park_num: park_num,
		  mode: e2.target.getAttribute('data-mode'),
		  comments: spotComment
		});
	    }
	    closePotaPlusLogDialog();
	// Attempt (hack/brute-force) to fix elusive bug where QSL button gets "jumbled".
	Array.from( MAINTABLE.querySelectorAll('[data-marker="QSL_BTN"]') , e => e.remove() );
	Array.from( MAINTABLE.querySelectorAll('[data-marker="LOG_BTN"]') , e => e.remove() );
	Array.from( MAINTABLE.querySelectorAll('[data-marker="RST_RCVD"]') , e => e.remove() );
	Array.from( MAINTABLE.querySelectorAll('[data-marker="TOGGLE_BTN"]') , e => e.remove() );
	pokeMainTable(); // touch, to trigger initial update
	if( OPTIONS.loggingConfig.forceRefresh ){
		setTimeout(() => { document.location.reload(); }, 500 ); // short delay (in milliseconds) to give logging fetch's time to fire.
	}
}

function postPotaSpot(opts){
  opts = opts || {};
  if( ! opts.call || ! opts.park_num ){
    return;
  }
  if( TOKEN ){
    POTA_API_OPTS = getPotaApiOpts(TOKEN);
  }
  if( ! TOKEN ){
    alert('POTAPlus: logged, but spotting needs a signed-in POTA session. Sign in and try Spot+Log again.');
    return;
  }
  var headers = Object.assign({ 'Content-Type': 'application/json' }, (POTA_API_OPTS && POTA_API_OPTS.headers) || {});
  var body = {
    activator: opts.call,
    spotter: MYCALL || '',
    frequency: String(opts.freq || '').replace(/[^\d.]/g, ''),
    reference: opts.park_num,
    mode: opts.mode || 'SSB',
    source: 'Web',
    comments: opts.comments || ''
  };
  _fetch('https://api.pota.app/spot', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  }).then(function(response){
    if( response && ! response.ok ){
      console.log('POTAPlus spot POST failed', response.status);
      alert('POTAPlus: logged, but the POTA spot POST failed (' + response.status + '). Check that you are signed in.');
    }
  }).catch(function(err){
    console.log('POTAPlus spot POST error', err);
  });
}

function closePotaPlusLogDialog(){
  var el = document.getElementById('potaplus_log_dialog');
  if( el && el.parentNode ){
    el.parentNode.removeChild(el);
  }
}

function openPotaPlusLogDialog(ctx){
  closePotaPlusLogDialog();
  var rst = ctx.mode == 'SSB' ? '59' : (ctx.mode == 'CW' || ctx.mode == 'RTTY' ? '599' : '');
  var overlay = document.createElement('div');
  overlay.id = 'potaplus_log_dialog';
  overlay.setAttribute('data-potaplus-log-dialog', '1');
  overlay.setAttribute('role', 'dialog');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:40000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:16px;color-scheme:light;';
  var card = document.createElement('div');
  card.className = 'potaplus-log-card';
  card.style.cssText = 'max-width:560px;width:100%;border:4px solid #1976d2;border-radius:8px;padding:16px;background:#f4f6f8;color:#111;font-family:system-ui,sans-serif;color-scheme:light;';
  var title = document.createElement('div');
  title.style.cssText = 'font-size:18px;font-weight:600;margin-bottom:12px;color:#111;';
  title.textContent = 'POTAPlus log  ' + (ctx.call || '') + ' @ ' + (ctx.park_num || '');
  card.appendChild(title);
  function field(id, label, value, width){
    var wrap = document.createElement('label');
    wrap.style.cssText = 'display:inline-block;margin:0 8px 10px 0;min-width:' + (width || '120px') + ';font-size:13px;color:#111;';
    wrap.appendChild(document.createTextNode(label));
    wrap.appendChild(document.createElement('br'));
    var input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.value = value == null ? '' : String(value);
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;margin-top:2px;background:#fff;color:#111;border:1px solid #78909c;border-radius:4px;';
    wrap.appendChild(input);
    return wrap;
  }
  card.appendChild(field('RST_SENT', 'RST Sent (ctrl-#)', rst, '140px'));
  card.appendChild(field('RST_RCVD', 'RST Rcvd (ctrl-#)', rst, '140px'));
  card.appendChild(field('TX_PWR', 'TX PWR', TX_PWR || '', '90px'));
  card.appendChild(field('RX_PWR', 'RX PWR', '', '90px'));
  card.appendChild(field('OTHER_OPS', 'Other Ops (comma/space)', '', '240px'));
  var nferExtras = [];
  if( OPTIONS && OPTIONS.enableNferAutofill ){
    nferExtras = nferParkRefs(
      ctx.park_num,
      ctx.locationDesc || '',
      [ctx.comments, ctx.rowText].filter(Boolean).join(' ')
    );
  }
  card.appendChild(field('PARKNUM2', 'Park Ref #2', nferExtras[0] || '', '110px'));
  card.appendChild(field('PARKNUM3', 'Park Ref #3', nferExtras[1] || '', '110px'));
  card.appendChild(field('PARKNUM4', 'Park Ref #4', nferExtras[2] || '', '110px'));
  card.appendChild(field('PARKNUM5', 'Park Ref #5', nferExtras[3] || '', '110px'));
  if( nferExtras.length ){
    var nferNote = document.createElement('div');
    nferNote.style.cssText = 'font-size:12px;color:#37474f;margin:-4px 0 8px;';
    nferNote.textContent = 'N-fer auto-fill: ' + nferExtras.join(', ');
    card.appendChild(nferNote);
  }
  var commentsWrap = document.createElement('label');
  commentsWrap.style.cssText = 'display:block;margin:4px 0 12px;font-size:13px;color:#111;';
  commentsWrap.appendChild(document.createTextNode('Comments (included on Spot+Log)'));
  commentsWrap.appendChild(document.createElement('br'));
  var comments = document.createElement('input');
  comments.type = 'text';
  comments.id = 'POTAPLUS_COMMENTS';
  comments.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;margin-top:2px;background:#fff;color:#111;border:1px solid #78909c;border-radius:4px;';
  commentsWrap.appendChild(comments);
  card.appendChild(commentsWrap);
  card.querySelector('#RST_SENT').setAttribute('data-defaultrst', rst);
  card.querySelector('#RST_RCVD').setAttribute('data-defaultrst', rst);
  card.querySelector('#RST_SENT').addEventListener('keydown', RST_ctrlNum);
  card.querySelector('#RST_RCVD').addEventListener('keydown', RST_ctrlNum);
  var actions = document.createElement('div');
  actions.className = 'potaplus-log-actions';
  actions.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:8px;';
  function makeBtn(value, doSpot, extraClass){
    var b = document.createElement('input');
    b.type = 'button';
    b.value = value;
    if( extraClass ){ b.className = extraClass; }
    b.setAttribute('data-URL', ctx.url || '');
    b.setAttribute('data-ping-URL', ctx.ping_url || '');
    b.setAttribute('data-call', ctx.call || '');
    b.setAttribute('data-park_num', ctx.park_num || '');
    b.setAttribute('data-park_region', ctx.park_region || '');
    b.setAttribute('data-freq', ctx.freq || '');
    b.setAttribute('data-mode', ctx.mode || '');
    b.setAttribute('data-band', ctx.band || '');
    b.style.cssText = 'padding:8px 14px;cursor:pointer;';
    b.addEventListener('click', function(ev){ logBtnClick(ev, doSpot); });
    return b;
  }
  var cancel = document.createElement('input');
  cancel.type = 'button';
  cancel.value = 'Cancel';
  cancel.className = 'potaplus-log-cancel';
  cancel.style.cssText = 'padding:8px 14px;cursor:pointer;';
  cancel.addEventListener('click', closePotaPlusLogDialog);
  actions.appendChild(cancel);
  actions.appendChild(makeBtn('Log ' + (ctx.call || ''), false));
  actions.appendChild(makeBtn('Spot+Log', true, 'potaplus-log-spot'));
  card.appendChild(actions);
  overlay.appendChild(card);
  overlay.addEventListener('click', function(ev){
    if( ev.target === overlay ){ closePotaPlusLogDialog(); }
  });
  overlay.addEventListener('keydown', function(ev){
    if( ev.key === 'Escape' ){ closePotaPlusLogDialog(); }
  });
  document.body.appendChild(overlay);
  setTimeout(function(){
    var rstEl = document.getElementById('RST_RCVD');
    if( rstEl ){ rstEl.focus(); }
  }, 50);
}


/////////////////////////////////////////////////////////////

var SPOTS_TO_HIDE = {};
var REGION_FILTER_BY_USER = {};
var REGION_PRESET = 'custom';
var REGION_FILTER_USER = '';
var SPOT_ALERT_SEEN = {};
var SPOT_ALERT_SEEDED = false;
var SPOT_ALERT_LAST_TS = 0;

chrome.runtime.sendMessage({ message: "get__SPOTS_TO_HIDE" }, response => {
      if (response && response.message === 'success') {
	      SPOTS_TO_HIDE = response.payload || {};
      }
});

chrome.runtime.sendMessage({ message: "get__REGION_FILTER_BY_USER" }, response => {
      if (response && response.message === 'success') {
	      REGION_FILTER_BY_USER = response.payload || {};
	      loadUserRegionFilter();
	      try { pokeMainTable(); } catch (e) {}
      }
});

function persistUserRegionFilter(){
	var key = userFilterKey(MYCALL);
	REGION_FILTER_USER = key;
	REGION_FILTER_BY_USER[key] = {
	  preset: REGION_PRESET || 'custom',
	  hide: REGION_PRESET === 'custom' ? Object.assign({}, SPOTS_TO_HIDE) : {}
	};
	sendChromeMessage("set__REGION_FILTER_BY_USER", REGION_FILTER_BY_USER);
}

function loadUserRegionFilter(){
	var key = userFilterKey(MYCALL);
	REGION_FILTER_USER = key;
	if( OPTIONS && OPTIONS.enableRegionPresets === false ){
	  return;
	}
	var saved = REGION_FILTER_BY_USER[key];
	if( ! saved ){
	  return;
	}
	REGION_PRESET = saved.preset || 'custom';
	if( REGION_PRESET === 'custom' && saved.hide ){
	  SPOTS_TO_HIDE = Object.assign({}, saved.hide);
	  sendChromeMessage("set__SPOTS_TO_HIDE", SPOTS_TO_HIDE);
	}
}

function knownSpotRegions(){
	return Array.from(document.querySelectorAll('#filter_container input#spots_to_hide')).map(function(el){
	  return el.value;
	});
}

function snapshotPresetHide(regions){
	if( ! OPTIONS || ! OPTIONS.enableRegionPresets || ! REGION_PRESET || REGION_PRESET === 'custom' ){
	  return;
	}
	SPOTS_TO_HIDE = regionPresetHideMap(REGION_PRESET, regions || knownSpotRegions(), LOCATIONS_HUNTED);
	sendChromeMessage("set__SPOTS_TO_HIDE", SPOTS_TO_HIDE);
}

function updateHuntKeyMap(){
	var box = document.getElementById('potaplus_hunt_keys');
	if( ! box ){
	  return;
	}
	if( ! OPTIONS || ! OPTIONS.enableHuntKeys ){
	  box.style.display = 'none';
	  box.innerHTML = '';
	  return;
	}
	box.innerHTML = renderHuntKeyMapHtml();
	box.style.display = '';
}

function potaPlusModalOpen(){
	if( document.getElementById('potaplus_log_dialog') ){
	  return true;
	}
	return !!document.querySelector('.v-overlay--active, .v-dialog--active');
}

function clickQslForSelected(){
	if( ! OPTIONS || ! OPTIONS.enableLogging ){
	  return false;
	}
	var rows = collectSpotRows();
	var first = null;
	for( var i = 0; i < rows.length; i++ ){
	  var row = rows[i];
	  var btn = row.querySelector('[data-marker="QSL_BTN"]');
	  if( ! btn ){
	    continue;
	  }
	  var outer = LISTMODE ? row : (row.closest('[data-spot-activator], .v-col') || row);
	  if( outer && outer.style.display === 'none' ){
	    continue;
	  }
	  if( row.style.display === 'none' ){
	    continue;
	  }
	  var call = btn.getAttribute('data-call');
	  if( selectedcall && call === selectedcall ){
	    btn.click();
	    return true;
	  }
	  if( ! first ){
	    first = btn;
	  }
	}
	if( first ){
	  first.click();
	  return true;
	}
	return false;
}

function playSpotAlertBeep(){
	try {
	  var AC = window.AudioContext || window.webkitAudioContext;
	  if( ! AC ){
	    return;
	  }
	  var ctx = playSpotAlertBeep._ctx || (playSpotAlertBeep._ctx = new AC());
	  if( ctx.state === 'suspended' && ctx.resume ){
	    ctx.resume();
	  }
	  var osc = ctx.createOscillator();
	  var gain = ctx.createGain();
	  osc.type = 'sine';
	  osc.frequency.value = 880;
	  gain.gain.setValueAtTime(0.12, ctx.currentTime);
	  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
	  osc.connect(gain);
	  gain.connect(ctx.destination);
	  osc.start();
	  osc.stop(ctx.currentTime + 0.2);
	} catch (e) {}
}

function showSpotAlertToast(call, park, region, kind){
	var box = document.getElementById('potaplus_spot_alert');
	if( ! box ){
	  box = document.createElement('div');
	  box.id = 'potaplus_spot_alert';
	  box.setAttribute('role', 'status');
	  document.body.appendChild(box);
	}
	var label = kind === 'atno' ? 'needed ATNO' : kind === 'region' ? 'needed region' : 'needed ATNO / region';
	box.textContent = 'POTAPlus: ' + label + ' — ' + call + ' @ ' + park + ' (' + region + ')';
	box.classList.add('potaplus-spot-alert-on');
	clearTimeout(showSpotAlertToast._t);
	showSpotAlertToast._t = setTimeout(function(){
	  box.classList.remove('potaplus-spot-alert-on');
	}, 4000);
}

function considerSpotAlert(call, park_num, park_region){
	if( ! OPTIONS || ! OPTIONS.enableSpotAlerts ){
	  return;
	}
	var kind = potaplusSpotAlertKind(park_num, park_region, PARKS_HUNTED, LOCATIONS_HUNTED);
	var key = potaplusSpotAlertKey(call, park_num, park_region);
	var now = Date.now();
	var decision = potaplusSpotAlertDecide({
	  enabled: true,
	  mute: OPTIONS.spotAlertMute,
	  throttleSec: OPTIONS.spotAlertThrottleSec,
	  lastTs: SPOT_ALERT_LAST_TS,
	  now: now,
	  seeded: SPOT_ALERT_SEEDED,
	  seen: SPOT_ALERT_SEEN,
	  key: key,
	  kind: kind
	});
	if( decision.seed || decision.mark || decision.alert ){
	  SPOT_ALERT_SEEN[key] = true;
	}
	if( decision.alert ){
	  SPOT_ALERT_LAST_TS = now;
	  showSpotAlertToast(call, park_num, park_region, kind);
	  if( decision.beep ){
	    playSpotAlertBeep();
	  }
	}
}

function updateFilterHide(k,v){
	if( OPTIONS && OPTIONS.enableRegionPresets && REGION_PRESET !== 'custom' ){
	  snapshotPresetHide();
	  REGION_PRESET = 'custom';
	}
	SPOTS_TO_HIDE[k] = v;
	sendChromeMessage("set__SPOTS_TO_HIDE",  SPOTS_TO_HIDE );
	persistUserRegionFilter();
	pokeMainTable(); // touch, to trigger initial update
}

var SPOT_FILTER_DETAILS_TOGGLE = 0; 

function hourBetween(t, start, end){
	// all 3 params are UTC HHMM
	// return bool for:    start <= t < end
	if ( end < start ){
		end = ( (end*1) + 2400 ).toString().padStart(2, '0');
	}
	if ( t < start ){
		t = ( (t*1) + 2400 ).toString().padStart(2, '0');
	}
	var isBetween =  ( start <= t && t < end );
	// console.log( `==== hourBetween( ${t}, ${start}, ${end} ) => ${isBetween}` );
	return isBetween;
}
/////////////////////////////////////////////////////////////

function collectSpotRows(){
  detectLayout();
  if( ! MAINTABLE ){
    return [];
  }
  if( LISTMODE && MAINTABLE.rows ){
    return Array.from(MAINTABLE.rows);
  }
  return Array.from(MAINTABLE.querySelectorAll('[data-spot-activator], [ext-spot], .spot-card'));
}

function mapSpotCells(row){
  var cells = LISTMODE && row.cells ? row.cells : [];
  var objs;
  if( LISTMODE ){
    var cmap = mapTableColumns(row.closest('table'), SPOT_COLUMN_ALIASES);
    var lastIdx = cells.length ? cells.length - 1 : 0;
    objs = {
      call:		cellAt(row, cmap.call) || cells[1] || null,
      freq:		cellAt(row, cmap.freq) || cells[2] || extSlot(row, 'freq'),
      mode:		cellAt(row, cmap.mode),
      park_num:		cellAt(row, cmap.park_num) || cells[3] || extSlot(row, 'ref'),
      park_name:	cellAt(row, cmap.park_name) || cellAt(row, cmap.park_num) || cells[3] || null,
      park_region:	cellAt(row, cmap.park_region) || cells[4] || null,
      btns:		cellAt(row, cmap.btns) || extSlot(row, 'btn-acts') || cells[lastIdx] || null,
      extLinks:		cellAt(row, cmap.history) || extSlot(row, 'actv') || cellAt(row, cmap.btns) || cells[lastIdx] || null,
      historyBtn:	findHistoryButton(cellAt(row, cmap.history) || cellAt(row, cmap.btns) || cells[lastIdx] || row),
      spottime:		cellAt(row, cmap.spottime) || cells[0] || null,
    };
  } else {
    var card = row.classList && row.classList.contains('spot-card') ? row : (row.querySelector('.spot-card') || row);
    var titleEl = cardTitle(card) || row.querySelector('.pota-mono');
    objs = {
      call:		titleEl || extSlot(row, 'actv'),
      freq:		extSlot(row, 'freq') || card.querySelector('.pota-mono'),
      mode:		null,
      park_num:		row.querySelector('a[href^="/park/"]') || extSlot(row, 'ref') || titleEl,
      park_name:	row.querySelector('a[href^="/park/"]:not(.pota-mono)') || titleEl,
      park_region:	null,
      btns:		extSlot(row, 'btn-acts') || cardActions(card) || row.querySelector('.spot-actions'),
      extLinks:		extSlot(row, 'actv') || row.querySelector('.v-btn'),
      historyBtn:	findHistoryButton(row),
      spottime:		null,
    };
  }
  return objs;
}

function placeChrome(row, objs, markerEl, slotName, fallbackEl, how){
  if( fillExtSlot(row, slotName, markerEl) ){
    return true;
  }
  var host = fallbackEl || (objs && objs.btns);
  if( ! host ){
    return false;
  }
  if( how === 'prepend' && host.prepend ){
    host.prepend(markerEl);
  } else {
    host.append(markerEl);
  }
  return true;
}

function onQsySelect(btn){
  var callsign = btn.getAttribute("data-callsign");
  var p = btn.getAttribute("data-parknum");
  lookupOpHunted(callsign);
  lookupParkHunted(p);
  updateActivationBio(callsign, p);
  chrome.runtime.sendMessage({
    message: "set__selectedcall",
    payload: callsign
  }, function(){});
  var COLOR1 = DARKMODE ? 'darkslategrey' : 'lightgreen';
  if( selectedcall != callsign ){
    setBackgroundForCallsign(selectedcall, '');
    selectedcall3 = selectedcall2;
    selectedcall2 = selectedcall;
    selectedcall  = callsign;
    setCurrentCallsignBackground(COLOR1);
  }
}

var observer;
var FILTER_SIG = '';
var paintSpots;
if( observer == null ){
observer = new MutationObserver(function(mutations){
    if( ! mutationsAffectSpots(mutations) ){
	return;
    }
    if( paintSpots ){
	paintSpots();
    }
});
paintSpots = debounceFn(function(){
    var route = getPotaRoute();
    if( route == "activations" ){
	try { observer.disconnect(); } catch (e) {}
	hidePotaPlusPageChrome();
	return;
    }
    if( route != "spots" ){
	try { observer.disconnect(); } catch (e) {}
	hidePotaPlusPageChrome();
	return;
    }
    showPotaPlusPageChrome();
    placeToolbar();
    getWidgetHost();
    detectLayout();
    if( ! MAINTABLE ){
	return;
    }

    if( OPTIONS == null ){
	    return;
    }
    if( OPS_HUNTED == null ){
	    OPS_HUNTED = {};
    }
    if( document.getElementById('btn_info') ){
      document.getElementById('btn_info').classList.remove('warning');
    }

    observer.disconnect();

    var SPOT_ATTRIBUTES = { "bands":{}, "modes":{}, "programs":{}, "regions":{} };

    var rows = collectSpotRows();
    var COLOR1 = DARKMODE ? 'darkslategrey'	: 'lightgreen';
    var COLOR2 = DARKMODE ? 'dimgrey'		: 'inherit';
    var COLOR3 = DARKMODE ? 'black'		: 'inherit';
    for (let row of rows) {
      if( ! row || row.nodeType !== 1 ){
	continue;
      }
      if( closestAwardEarnedTable(row) ){
	continue;
      }
      if( LISTMODE && row.getAttribute && ! row.getAttribute('data-spot-activator') && ! extHook(row, 'actv') ){
	continue;
      }
      var cells = LISTMODE && row.cells ? row.cells : [];
      var objs = mapSpotCells(row);
      if( LISTMODE && !cells.length && !extHook(row, 'actv') ) {
	    continue;
      }
      var btnStyle = "border: 2px solid grey; border-radius: 5px; padding:3px;";
      var hook = function(name){ return extHook(row, name); };
      var call = hook('actv') || (row.getAttribute && row.getAttribute('data-spot-activator'))
		|| (objs.call && objs.call.innerText ? objs.call.innerText.trim().replace(/\s+/g,' ').split(' ')[0] : '');
      if( ! call ){
	    continue;
      }
      var freqOrig = hook('freq') || '';
      if( ! freqOrig && objs.freq ){
	if( objs.freq.querySelector && objs.freq.querySelector('input#btn_qsy, input.potaplus-qsy') ){
	  freqOrig = objs.freq.querySelector('input#btn_qsy, input.potaplus-qsy').getAttribute('data-freqorig') || '';
	}else{
	  freqOrig = (objs.freq.innerText || '').trim();
	}
      }
      var modeFromCol = hook('mode') || ((objs.mode && objs.mode.innerText) ? objs.mode.innerText.trim() : '');
      if( modeFromCol && ! /\(.*\)/.test(freqOrig) ){
	freqOrig = String(freqOrig).replace(/\s*kHz.*/i,'') + ' (' + modeFromCol + ')';
      }
      if( ! freqOrig ){
	    continue;
      }
      var freq = freqOrig;
      var freqLabel = freq.replace(/(\d)(\d\d\d)($| |\D)/,'$1.$2$3');
      var park_num = (objs.park_num && objs.park_num.innerText) ? objs.park_num.innerText.trim() : '';
      var parsedRef = parseParkReference(hook('ref')) || parseParkReference(park_num) || parseParkReference(row.innerText);
      if( parsedRef ){
	      park_num = parsedRef;
      }
      var park_name = ((objs.park_name || objs.park_num) && (objs.park_name || objs.park_num).innerText)
	? (objs.park_name || objs.park_num).innerText.trim().replaceAll('"',"'")
	: '';
      park_name = normalizeParkName(park_name, false);
      var park_region = (objs.park_region && objs.park_region.innerText) ? objs.park_region.innerText.replace(/\n.+/,'').trim() : '';
      park_region = park_region.replace(/(0|\d+\/\d+)$/,'').trim();
      if( ! park_region ){
	park_region = parseRegionFromText(row.innerText, park_num);
      }
      var park_program = park_region.replace(/-.+/,'');
      if( LISTMODE ){
	      park_num = park_num.replace(/\s.+/, '');
      }
      if( CARDMODE ){
	      park_num = parsedRef || park_num.replace(/.+ @\s*/, '');
	      park_name = normalizeParkName(park_name, true);
      }
      if( ! park_num ){
	    continue;
      }
      var modeLog = freq.match(/\((.+)\)/);
      modeLog = modeLog != null ? modeLog[1] : (hook('mode') || 'SSB');
      freq = String(freq).replace(/ .+/,''); // freq is now numeric, in kHz
      var modeQsy =
		  modeLog.match( /FT.*/    ) ? OPTIONS.qsyConfig.dataMode
		: modeLog.match( /JT.*/    ) ? OPTIONS.qsyConfig.dataMode
		: modeLog.match( /.*PSK.*/ ) ? OPTIONS.qsyConfig.dataMode
		: modeLog.match( /SSTV/    ) ? OPTIONS.qsyConfig.dataMode
		: modeLog.match( /CW/      ) ? OPTIONS.qsyConfig.cwMode
		: modeLog.match( /SSB/ ) && freq ? ( freq >= 10000 || (freq>=5000 && freq<6000) ? 'USB' : 'LSB' ) // USB for 30m & up, plus 60M; LSB for 40M, 80m & below
		:                              modeLog  // SSB, AM, FM, CW, etc
      ;
      var band= freq >=10500000 ? '' // unknown
	    // http://www.arrl.org/band-plan
	    :	freq >=10000000 ?  '3cm'
	    :	freq >= 5650000 ?  '5cm'
	    :	freq >= 3300000 ?    '' // ??
	    :	freq >= 2300000 ? '13cm'
	    :	freq >= 1240000 ? '23cm'
	    :	freq >=  902000 ? '33cm'
	    :	freq >=  420000 ? '70cm'
	    :	freq >=  222000 ?'1.25M'
	    :	freq >=  140000 ?   '2M'	//144000
	    :	freq >=   50000 ?   '6M'
	    :	freq >=   28000 ?  '10M'
	    :	freq >=   24000 ?  '12M'
	    :	freq >=   21000 ?  '15M'
	    :	freq >=   18000 ?  '17M'
	    :	freq >=   14000 ?  '20M'
	    :	freq >=   10000 ?  '30M'
	    :	freq >=    7000 ?  '40M'
	    :	freq >=    5000 ?  '60M'
	    :	freq >=    3500 ?  '80M'
	    :	freq >=    1800 ? '160M'
	    :			'' // unknown
      ;
      if( hook('band') ){
	band = String(hook('band')).toUpperCase().replace(/\s+/g,'');
      }
      var isUSGeneralOutOfBand = false
	    || (  3500 <= freq && freq <=  3525 )
	    || (  3600 <= freq && freq <=  3800 )
	    || (  7000 <= freq && freq <=  7025 )
	    || (  7125 <= freq && freq <=  7175 )
	    || ( 14000 <= freq && freq <  14025 )
	    || ( 14150 <= freq && freq <  14225 )
	    || ( 21000 <= freq && freq <  21025 )
	    || ( 21200 <= freq && freq <  21275 )
      ;
      var isSSBUSBandEdges = false
	    || [1800, 3600, 3700, 3800, 7125, 7175]
		.filter((x) => { var y = freq - x; return 0<=y && y<3 } ).length > 0
	    || [14350, 18168, 21450, 24990, 29700, 54000]
		.filter((x) => { var y = x - freq; return 0<=y && y<3 } ).length > 0
      ;

      var today = new Date();
      var todayStr = today.getUTCFullYear() + '-' + (1+today.getUTCMonth()).toString().padStart(2, '0') + '-' + today.getUTCDate();
      var spotKey = [ call, park_num, band, modeLog, todayStr ].join(":");
      var alreadyPainted = row.getAttribute('data-potaplus-key') === spotKey
	    && row.querySelector('[data-marker="QSY_BTN"], [data-marker="LOG_BTN"], [data-marker="TOGGLE_BTN"]');
      if( ! alreadyPainted ){
	Array.from(row.querySelectorAll('[data-marker]')).forEach(function(el){ el.remove(); });
	row.setAttribute('data-potaplus-key', spotKey);
      }

    if( ! alreadyPainted && OPTIONS.enableSpotTimeAbbrv && LISTMODE && objs.spottime ){
	var AGE_RE = /ago|now|^\s*\d+\s*[mh]\s*$/i;
	var timeObj = Array.from(objs.spottime.querySelectorAll('span')).find(el => AGE_RE.test(el.textContent));
	if( ! timeObj && AGE_RE.test(objs.spottime.innerText || '') ){
		timeObj = objs.spottime;
	}
	if( timeObj){
		var s = timeObj.innerText
				.replace(/ mins? ago/, ' ')
				.replace(/m ago/, ' ')
				.replace(/\d+ sec ago/, '<1 ')
		;
		//timeObj.innerHTML = s;
//		timeObj.prepend(s);
		var time2 = timeObj.parentElement.querySelector('span#time_label');
		if( ! time2 ){
		  time2 = document.createElement('span');
		  time2.setAttribute('id', 'time_label');
		  timeObj.parentElement.append(time2);
		}
		// TODO -- don't make this dependent upon enableSpotTimeAbbrv option.
		var info = PARK_INFO[park_num] ? PARK_INFO[park_num]['info'] : {};
		if( info['longitude'] ){
		  var now = new Date().toISOString().slice(11,13) + "00"; // HH00  in UTC
		  if( hourBetween(now, info['lateshift_start'], info['lateshift_end']) ){
			  s += ` =LS>${info['lateshift_start']}`;
		  }else if( hourBetween(now, info['earlyshift_start'], info['earlyshift_end']) ){
			  s += ` =ES<${info['earlyshift_end']}`;
		  }
		}else{
		  s += '.';
		}
		time2.innerHTML = s;
		timeObj.style.display = 'none';
	}
//      objs.spottime.innerHTML = objs.spottime.innerHTML.toString().replace(/ mins? ago/, ' ');
//      objs.spottime.innerHTML = objs.spottime.innerHTML.toString().replace(/\d+ sec ago/, '<1 ');
    }


    SPOT_ATTRIBUTES['bands'   ][band]         ||= {};
    SPOT_ATTRIBUTES['modes'   ][modeLog]      ||= {};
    SPOT_ATTRIBUTES['programs'][park_program] ||= {};
    SPOT_ATTRIBUTES['regions' ][park_region]  ||= {};
    // var spotSlot = band + '/' + modeLog + '/' + park_region;
    SPOT_ATTRIBUTES['bands'   ][band        ][modeLog + '/' + park_region]++;
    SPOT_ATTRIBUTES['modes'   ][modeLog     ][band + '/' + park_region   ]++;
    SPOT_ATTRIBUTES['programs'][park_program][band + '/' + modeLog + '/' + park_region]++;
    SPOT_ATTRIBUTES['regions' ][park_region ][band + '/' + modeLog       ]++;

    // Band / Mode / Program filters are built into pota.app; POTAPlus only adds Region.
    var hideSpot = false;
    if( OPTIONS.enableSpotFilters ){
      if( OPTIONS.enableRegionPresets && REGION_PRESET && REGION_PRESET !== 'custom' ){
	hideSpot = ! regionMatchesPreset(REGION_PRESET, park_region, LOCATIONS_HUNTED);
      } else {
	hideSpot = !!SPOTS_TO_HIDE[park_region];
      }
    }
    var outer = LISTMODE ? row : (row.closest('[data-spot-activator], .v-col') || row);
    if( outer ){
      outer.style.display = hideSpot ? 'none' : '';
    }
    if( ! hideSpot ){
      considerSpotAlert(call, park_num, park_region);
    }


    objs.badges = row.querySelector('[data-marker="BADGE_HOLDER"]');
    if( ! objs.badges ){
	  objs.badges = document.createElement('div');
	  objs.badges.setAttribute('data-marker','BADGE_HOLDER');
	  objs.badges.classList.add('v-badge__wrapper');
	  objs.badges.style.position='absolute';
	  if( LISTMODE ){
	    objs.badges.style.top='30px';
	    objs.badges.style.left='20px';
	  }
	  if( CARDMODE ){
	    objs.badges.style.display = 'contents';
	    objs.badges.style.position = 'relative';
	  }
	  objs.badges.style.fontFamily='monospace';
	  objs.badges.innerHTML = '';
	  if( ! placeChrome(row, objs, objs.badges, 'ref', objs.park_num, 'append') && objs.park_num ){
	    objs.park_num.append(objs.badges);
	  }
    }

//-------------------------------------
    if( OPTIONS.enableNeededLocations && LOCATIONS_HUNTED && ! row.querySelector('[data-marker="LOCATIONS_HUNTED"]') ){
      var loc = park_region.replace(/,.+/,'');
      if(LOCATIONS_HUNTED.length ){
        var parkWorked = findInList(PARKS_HUNTED, x => x && x.reference === park_num );
        var hunted = findInList(LOCATIONS_HUNTED, x => x && x.locationDesc === loc );
		// keys: locationDesc, locationId, locationName, numParksActivated, numParksAvailable, toGo
//if Region not found as a Location, then "0" warning badge;  else if new-park then accent badge with the numParksActivated / numParksAvailable count.
	var label = hunted == null ? "0"
	      	: hunted.numParksActivated + "/" + hunted.numParksAvailable
	      ;
	var title = hunted == null ? "New needed location"
	      	: hunted.numParksActivated + "/" + hunted.numParksAvailable + " references worked for this location"
	      ;
        if( ! parkWorked ){ // new park#
//console.log('NEEDED', park_region, park_num, call, hunted);
	  var badge = document.createElement('span');
	  badge.setAttribute('data-marker','LOCATIONS_HUNTED');
	  badge.classList.add('v-badge__wrapper');
	  if( LISTMODE ){
	    badge.style.position='relative';
	    badge.style.top='15px';
	    badge.style.left='-15px';
	  }else{
	    badge.style.position='absolute';
	    badge.style.top='0px';
	    badge.style.left='35px';
	  }
	  badge.style.fontFamily='monospace';
	  badge.innerHTML = `<span class="v-badge__badge warning" title="${title}">${label}</span>`;
	  if( ! placeChrome(row, objs, badge, 'ref', objs.park_region, 'append') && objs.park_region ){
	    objs.park_region.append(badge);
	  }
        }
      }
    } // OPTIONS.enableNeededLocations

//-------------------------------------
    if( OPTIONS.enableNeededWAS && WAS_HUNTED && ! row.querySelector('[data-marker="WAS_HUNTED"]') ){
      var state = park_region.replace(/,.+/,'');
      if(WAS_HUNTED.length && state.match(/^US-..$/) && state != 'US-VI' ){
        var hunted = findInList(WAS_HUNTED, x => x && x.locationDesc === state );
        if( hunted == null ){
//console.log('NEEDED', park_region, park_num, call, hunted);
	  var badge = document.createElement('span');
	  badge.setAttribute('data-marker','WAS_HUNTED');
	  badge.classList.add('v-badge__wrapper');
	  if( LISTMODE ){
	    badge.style.position='relative';
	    badge.style.top='10px';
	    badge.style.left='-5px';
	  }else{
	    badge.style.position='absolute';
	    badge.style.top='0px';
	    badge.style.left='35px';
	  }
	  badge.style.fontFamily='monospace';
	  badge.innerHTML = `<span class="v-badge__badge warning">WAS</span>`;
	  if( ! placeChrome(row, objs, badge, 'ref', objs.park_region, 'append') && objs.park_region ){
	    objs.park_region.append(badge);
	  }
        }
      }
    } // OPTIONS.enableNeededWAS

//-------------------------------------

//-------------------------------------
    if( ! row.querySelector('[data-marker="QSY_BTN"]') ){
//console.log("SPOT", [ call, freq, band, modeQsy, modeLog, park_num, park_region, park_name ] );
//console.log("SPOT", {"call":call, "freq":freq, "band":band, "modeQsy":modeQsy, "modeLog":modeLog, "park_num":park_num, "park_region":park_region, "park_name":park_name } );
      var x = document.createElement('span');
      x.setAttribute('data-marker', 'QSY_BTN' );
      var qsyLabel = LISTMODE ? 'QSY' : 'QSY '+freqLabel;
      var qsyStyle = btnStyle;
      qsyStyle += LISTMODE ? '' : 'min-width:80%;';
      var btnType="button";
      var btnClass = "ma-2 v-btn v-btn--is-elevated v-btn--has-bg theme--light v-size--default";
      if( !OPTIONS.enableQsy ){
	btnType="radio";
	qsyLabel = LISTMODE ? 'INFO' : 'INFO '+freqLabel;
	qsyStyle = "transform:scale(2.5); margin-right:10px;";
	btnClass = "";
      }
      x.innerHTML = `
	<input id="btn_qsy"
	    data-callsign="${call}"
	    type='${btnType}'
	    value='${qsyLabel}'
	    style="${qsyStyle}"
	    title="QSY ${freqLabel} ==> ${call} ${band} ${modeLog}"
	    data-freq="${freq}"
	    data-band="${band}"
	    data-mode="${modeQsy}"
	    data-freqorig="${freqOrig}"
	    data-spotKey="${spotKey}"
	    data-parknum="${park_num}"
	    class="${btnClass} potaplus-qsy"
	    ${ call == selectedcall ? 'CHECKED' : '' }
	    />
	    ${ CARDMODE && ! OPTIONS.enableQsy ? freqOrig : '' }
	`;
      x.addEventListener('click', (e2) => {
	onQsySelect(e2.target);
	if( !OPTIONS.enableQsy ){
	      return;
        }
	if( scanning && scan_call != e2.target.getAttribute('data-callsign') ){
	    // halt scanning if we're clicking on something out of order.
	    var scanBtn = document.getElementById('btn_scan');
	    if( scanBtn ){ scanBtn.click(); }
	}
	var freq = e2.target.getAttribute('data-freq');
	var mode = e2.target.getAttribute('data-mode');
	scan_call = e2.target.getAttribute('data-callsign'); // have scan pick up from here
	var url;
	var baseURL = OPTIONS.qsyConfig.proto + "://" + OPTIONS.qsyConfig.host + ":" + OPTIONS.qsyConfig.port;
	var baseParams = '';
//console.log(OPTIONS);
	if( OPTIONS.qsyConfig.target_host ){ baseParams += '&__host='+OPTIONS.qsyConfig.target_host; }
	if( OPTIONS.qsyConfig.target_port ){ baseParams += '&__port='+OPTIONS.qsyConfig.target_port; }
	if( OPTIONS.qsyConfig.method == 'commander' ){
          url = baseURL + "/dxlab/commander/CmdSetFreqMode"
			// param order matters here!
			+ "?xcvrfreq="+freq // kHz
			+ "&xcvrmode="+mode
			+ "&preservesplitanddual=N"
			+ baseParams;
	}else if( OPTIONS.qsyConfig.method == 'omnirig' ){
          url = baseURL + "/omnirig/qsy"
				+ "?freq=" + (freq*1000) // kHz (pota) => Hz (omnirig)
				+ "&mode=" + mode
				+ baseParams;
	}else if( OPTIONS.qsyConfig.method == 'aclog' ){
	  // ACLog does freq & mode in separate calls
          url = baseURL + "/aclog/changefreq"
				+ "?value=" + (freq/1000.0) // kHz (pota) => MHz (aclog)
				+ "&suppressmodedefault=TRUE"
				+ baseParams;
	  _fetch( url, { mode: 'no-cors' } );  // make 1st call ...
	  // ... and set url for second call, to be made below.
          url = baseURL + "/aclog/changemode"
				+ "?value=" + mode
				+ baseParams;
	}else if( OPTIONS.qsyConfig.method == 'logger32' ){
          url = baseURL + "/logger32/qsy"
				+ "?APP_SET_FREQ_MODE=" + freq // kHz
							+ "|" + mode
				+ baseParams;
	}
//console.log("URL:", url);
	if( !url ){
	  return;
	}
	_fetch( url, {});//{ mode: 'no-cors' } );
      });
      if( ! placeChrome(row, objs, x, 'freq', objs.freq, LISTMODE ? 'prepend' : 'append') ){
	if( objs.freq ){
	  if( LISTMODE ){ objs.freq.prepend(x); }
	  else { objs.freq.append(x); }
	}
      }
    } // OPTIONS.enableQsy
    if( objs.freq && objs.freq.style ){
      objs.freq.style.textDecoration = '';
    }
    if( OPTIONS.enableBandEdgeWarnings && objs.freq && ! row.querySelector('[data-marker="BAND_EDGE"]') ){
	var y = document.createElement('span');
	y.setAttribute('data-marker', 'BAND_EDGE' );
	if( isUSGeneralOutOfBand ){
		y.innerHTML += " {!EXTRA!}";
	}
	if( isSSBUSBandEdges ){
		y.innerHTML += " {!EDGE!}";
	}
	if( isUSGeneralOutOfBand || isSSBUSBandEdges ){
		objs.freq.append(y);
		objs.freq.style.textDecoration = 'line-through';
	}
    } // OPTIONS.enableBandEdgeWarnings

//-------------------------------------
    if( OPTIONS.enableLogging && ! row.querySelector('[data-marker="LOG_BTN"]') ){
      var y = document.createElement('span');
      y.setAttribute('data-marker', 'LOG_BTN' );
      y.innerHTML = `
	<input
	    type=button
	    value="QSL"
	    style="${btnStyle}; min-width:auto; padding-left: 5px; padding-right: 5px"
	    title="LOG ${call} @${park_num} ${band} ${modeLog}"
	    class="ma-2 v-btn v-btn--is-elevated v-btn--has-bg theme--light v-size--default orange accent-1 black--text"
	    data-freq="${freq}"
	    data-band="${band}"
	    data-mode="${modeLog}"
	    data-call="${call}"
	    data-park_num="${park_num}"
	    data-park_region="${park_region}"
	    data-park_name="${park_name}"
	    data-marker="QSL_BTN"
	    />
	`;
      y.addEventListener('mouseover', (e2) => {
	var p = e2.target.getAttribute("data-park_num");
	if( ! PARK_INFO[p] ){
	  lookupParkHunted(p);
	}
      });
      y.addEventListener('click', (e2) => {
	var p = e2.target.getAttribute("data-park_num");
	if( ! PARK_INFO[p] ){
	  lookupParkHunted(p);
	}
      });
	    // TODO --add double-click protection
      y.addEventListener('click', (e2) => {
	// TODO .. need to find callsign cell and cross-check the call to trap the error where QSL button is shifted wrt to spot row.
	var freq = e2.target.getAttribute('data-freq');
	var band = e2.target.getAttribute('data-band');
	var mode = e2.target.getAttribute('data-mode');
	var call = e2.target.getAttribute('data-call');
	var park_num = e2.target.getAttribute('data-park_num');
	var park_region = e2.target.getAttribute('data-park_region');
	var park_name = e2.target.getAttribute('data-park_name');
	var parkInfo = ( PARK_INFO[park_num] ? PARK_INFO[park_num]["info"] : {} ) || {};  // Will be missing park info if the QSY/radio selection was not used.
	var baseURL = OPTIONS.loggingConfig.proto + "://" + OPTIONS.loggingConfig.host + ":" + OPTIONS.loggingConfig.port;
	var baseParams = '';
	if( OPTIONS.loggingConfig.target_host ){ baseParams += '&__host='+OPTIONS.loggingConfig.target_host; }
	if( OPTIONS.loggingConfig.target_port ){ baseParams += '&__port='+OPTIONS.loggingConfig.target_port; }
	var additionalFields = '';
	Object.keys( OPTIONS.loggingConfig.additionalADIFFields ).forEach(function (key){
	  var value = OPTIONS.loggingConfig.additionalADIFFields[key];
	  value = value.replaceAll('%MYCALL%', MYCALL );
	  value = value.replaceAll('%PARKREF%', '__PARK_NUMS__' ); // park_num
	  value = value.replaceAll('%GRID4%', parkInfo.grid4 || '' );
	  value = value.replaceAll('%GRID6%', parkInfo.grid6 || '');
	  additionalFields += "&" + encodeLogParam(key) + "=" + encodeLogTemplate(value);
	});
	if( OPTIONS.loggingConfig.parkNumADIFField
		&& OPTIONS.loggingConfig.parkNumADIFField.trim()
		&& ! OPTIONS.loggingConfig.parkNumADIFField.match(/__DEPRECATED__/)
	    ){
	  additionalFields += "&"
		+ OPTIONS.loggingConfig.parkNumADIFField.trim().split(/[, ]+/).map(k=> k+"=__PARK_NUMS__").join("&")
	  ;
	}
	if( OPTIONS.loggingConfig.method != 'aclog' ){
	  additionalFields = appendPotaAdifFields(additionalFields);
	}
	if( OPTIONS.enableAdifGeo ){
	  additionalFields = appendAdifGeoFields(additionalFields, park_region);
	}
	if( OPTIONS.loggingConfig.method != 'aclog' && OPTIONS.loggingConfig.method != 'qrz' ){
	  additionalFields = appendStationAndGrid(additionalFields, MYCALL, parkInfo);
	}
	if( OPTIONS.loggingConfig.method == 'aclog' ){
	  var aclogGrid = parkInfo.grid6 || parkInfo.grid4 || '';
	  if( aclogGrid && additionalFields.toLowerCase().indexOf('grid=') === -1 ){
	    additionalFields += '&GRID=' + encodeLogParam(aclogGrid);
	  }
	}
        var url;
        var ping_url = '';
	var commentStr = "[POTA"
		+ " " + park_num
		+ " " + park_region
		+ " " + (parkInfo.grid6||'')
		+ " " + park_name
		+ "] __COMMENTS__";
	if( OPTIONS.loggingConfig.method == 'dxkeeper' ){
		//  http://www.dxlabsuite.com/dxkeeper/DXKeeper%20TCPIP%20Messages%20v1.pdf
          url = baseURL + "/dxlab/dxkeeper/log"
	    + "?" + "CALL=__CALL__"
	    + "&RST_SENT=__RST_SENT__"
	    + "&RST_RCVD=__RST_RCVD__"
	    + "&FREQ=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&FREQ_RX=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&BAND=" + encodeLogParam(band)
	    + "&MODE=" + encodeLogParam(mode)
	    + "&COMMENT=" + encodeLogTemplate(commentStr)
	    + "&QSO_DATE=__DATE_YYYYMMDD__" // YYYYMMDD 
	    + "&TIME_ON=__TIME_HHMMSS__" //   HHMMSS
	    + "&TX_PWR=__TX_PWR__"
	    + "&RX_PWR=__RX_PWR__"
	    + additionalFields
	    + baseParams
          ;
	  ping_url = baseURL + "/dxlab/dxkeeper/ping" + "?" + baseParams;
	}else if( OPTIONS.loggingConfig.method == 'logger32' ){
		//  https://www.logger32.net/files/Logger32_v4_User_Manual.pdf	Sections 31 & 32
          url = baseURL + "/logger32/log"
	    + "?" + "CALL=__CALL__"
	    + "&RST_SENT=__RST_SENT__"
	    + "&RST_RCVD=__RST_RCVD__"
	    + "&FREQ=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&FREQ_RX=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&MODE=" + encodeLogParam(mode)
	    + "&COMMENT=" + encodeLogTemplate(commentStr)
	    + "&QSO_DATE=__DATE_YYYYMMDD__" // YYYYMMDD 
	    + "&TIME_ON=__TIME_HHMMSS__" //   HHMMSS
	    + "&RX_PWR=__RX_PWR__"
	    + "&BAND=" + encodeLogParam(band) // Logger32 doesn't seem to calculate this from the freq fields
	    + additionalFields
	    + baseParams
          ;
	  ping_url = baseURL + "/logger32/ping" + "?" + baseParams;
	}else if( OPTIONS.loggingConfig.method == 'log4om' ){
          url = baseURL + "/log4om/log"
	    + "?" + "CALL=__CALL__"
	    + "&RST_SENT=__RST_SENT__"
	    + "&RST_RCVD=__RST_RCVD__"
	    + "&FREQ=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&FREQ_RX=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&BAND=" + encodeLogParam(band)
	    + "&MODE=" + encodeLogParam(mode)
	    + "&COMMENT=" + encodeLogTemplate(commentStr)
	    + "&QSO_DATE=__DATE_YYYYMMDD__" // YYYYMMDD 
	    + "&TIME_ON=__TIME_HHMMSS__" //   HHMMSS
	    + "&TX_PWR=__TX_PWR__"
	    + "&RX_PWR=__RX_PWR__"
//	    + "&APP_L4ONG_QSO_AWARD_REFERENCES=" + '[{"AC":"POTA","R":"' + park_num + '","G":"' + park_region + '","SUB":[],"GRA":[]}]'
//	    + "&APP_L4ONG_QSO_AWARD_REFERENCES=" + JSON.stringify([ { "AC":"POTA", "R":park_num, "G":park_region, "SUB":[], "GRA":[] } ])
	    + "&APP_L4ONG_QSO_AWARD_REFERENCES=__LOG4OM_PARKS__"
	    + additionalFields
	    + baseParams
          ;
	  ping_url = baseURL + "/log4om/ping" + "?" + baseParams;
	}else if( OPTIONS.loggingConfig.method == 'aclog' ){
		//  http://www.n3fjp.com/help/api.html
          url = baseURL + "/aclog/updateandlog"
	    + "?" + "CALL=__CALL__"
	    + "&MODE=" + encodeLogParam(mode)
	    + "&FREQ=" + (freq / 1000.0)  // kHz (pota) => MHz (aclog)
	    + "&RSTR=__RST_RCVD__"
	    + "&RSTS=__RST_SENT__"
	    + "&COMMENTS=" + encodeLogTemplate(commentStr)
	    + "&DATE=__DATE_YYYY_MM_DD__"
	    + "&TIMEON=__TIME_HHMM__"
	    + "&TIMEOFF=__TIME_HHMM__"
	    + "&POWER=__TX_PWR__"
		// __RX_PWR__   not suppported in ACLog?
	    + additionalFields
	    + baseParams
          ;
	}else if( OPTIONS.loggingConfig.method == 'qrz' ){  // API, not ham-apps-proxy
          url = // no ham-apps-proxy baseURL ... target will be in actual call; this is purely query params.
	      "CALL=__CALL__"
	    + "&RST_SENT=__RST_SENT__"
	    + "&RST_RCVD=__RST_RCVD__"
	    + "&FREQ=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&FREQ_RX=" + (freq / 1000.0)  // kHz (pota) => MHz (adif)
	    + "&BAND=" + encodeLogParam(band)
	    + "&MODE=" + encodeLogParam(mode)
	    + "&STATION_CALLSIGN=" + encodeLogParam(MYCALL || '')
	    + "&OPERATOR=" + encodeLogParam(MYCALL || '')
	    + "&COMMENT=" + encodeLogTemplate(commentStr)
	    + "&QSO_DATE=__DATE_YYYYMMDD__" // YYYYMMDD 
	    + "&TIME_ON=__TIME_HHMMSS__" //   HHMMSS
	    + "&TX_PWR=__TX_PWR__"
	    + "&RX_PWR=__RX_PWR__"
	    + additionalFields
	    // note: baseParams only used for ham-apps-proxy
          ;
	}
	var commentsEl = extSlot(row, 'comments');
	var commentsText = commentsEl ? (commentsEl.innerText || commentsEl.textContent || '') : '';
	var feedComments = '';
	if( SPOTS_FEED && SPOTS_FEED[call] && SPOTS_FEED[call][park_num] && Array.isArray(SPOTS_FEED[call][park_num].comments) ){
	  feedComments = SPOTS_FEED[call][park_num].comments.map(function(c){ return c && c.comments ? c.comments : ''; }).join(' ');
	}
	openPotaPlusLogDialog({
	  url: url,
	  ping_url: ping_url,
	  call: call,
	  park_num: park_num,
	  park_region: park_region,
	  mode: mode,
	  freq: freq,
	  band: band,
	  park_name: park_name,
	  locationDesc: parkInfo.locationDesc || '',
	  comments: [commentsText, feedComments].filter(Boolean).join(' '),
	  rowText: row.innerText || ''
	});
	return;
      });
      if( ! placeChrome(row, objs, y, 'btn-acts', objs.btns, 'append') ){
	if( objs.btns ){ objs.btns.append(y); }
      }
    } // OPTIONS.enableLogging

    if( ! row.querySelector('[data-marker="TOGGLE_BTN"]') ){
      var y = document.createElement('span');
      y.setAttribute('data-marker', 'TOGGLE_BTN' );
      var toggle = TOGGLES[spotKey] || 0;
      y.innerHTML = `
	<input
	    type=button
	    value="~"
	    style="${btnStyle};background-color:lightgrey !important; min-width: unset;"
	    title="Custom row toggle"
	    class="ma-2 v-btn v-btn--is-elevated v-btn--has-bg theme--light v-size--default accent-1 black--text"
	    data-call="${call}"
	    data-spotKey="${spotKey}"
	    data-toggle="${toggle}"
	    />
	`;
      var bgcolor = toggleColor(toggle);
      setBackgroundForRow(objs.btns, bgcolor);
      y.addEventListener('click', (e2) => {
		var call = e2.target.getAttribute('data-call');
		var spotKey = e2.target.getAttribute('data-spotKey');
		var toggle = e2.target.getAttribute('data-toggle');
		toggle = ( toggle + 1 ) % 3;
		TOGGLES[spotKey] = toggle;
		var bgcolor = toggleColor(toggle);
		e2.target.setAttribute('data-toggle', toggle );
		setBackgroundForRow(e2.target, bgcolor);
		var toggleBtnColor = bgcolor || 'lightgrey';
		e2.target.style.setProperty( 'background-color', toggleBtnColor, (toggleBtnColor?'important':'') );
		sendChromeMessage("set__TOGGLES",  TOGGLES );
      });
      if( ! placeChrome(row, objs, y, 'btn-acts', objs.btns, 'append') ){
	if( objs.btns ){ objs.btns.append(y); }
      }
    } // TOGGLE_BTN

    if( OPTIONS.enableIconQRZ && ! row.querySelector('[data-marker="QRZ_LINK"]') ){
	var a = document.createElement('a');
	a.setAttribute('href','https://qrz.com/db/'+call);
	a.setAttribute('title','QRZ.com');
	a.setAttribute('target','_blank');
        a.setAttribute('data-marker', 'QRZ_LINK');
	a.innerHTML = '<img style="width:20px; vertical-align:middle;margin-left:3px" src="' + chrome.runtime.getURL("images/qrz.ico") + '" />';
	if( ! placeChrome(row, objs, a, 'actv', objs.extLinks, 'prepend') && objs.extLinks ){
	  objs.extLinks.prepend(a);
	}
    }

      if( call == selectedcall ){
	setBackgroundForRow(objs.btns || row, COLOR1);
	updateBio(OPS_HUNTED[call]);
      }else if( TOGGLES[spotKey] ){
	var bgcolor = toggleColor( TOGGLES[spotKey] );
	setBackgroundForRow(objs.btns || row, bgcolor);
      }else{
	setBackgroundForRow(objs.btns || row, "");
      }
      var toggleBtnColor = TOGGLES[spotKey] ? toggleColor( TOGGLES[spotKey] ) : 'lightgrey';
      var toggleInput = row.querySelector('[data-marker="TOGGLE_BTN"]');
      if (toggleInput && toggleInput.querySelector('input')) {
      toggleInput.querySelector('input').style.setProperty( 'background-color', toggleBtnColor, (toggleBtnColor?'important':'') );
      }

///////////////////////////////////////
    } // rows

    var filterHtml = `
	<form style="background-color: lightgrey; padding:8px; width: fit-content; border-radius:10px">
		<b>HIDE SPOTS:</b>
    `;
    if( OPTIONS.enableRegionPresets ){
      filterHtml += '<div class="potaplus-region-presets" role="group" aria-label="Region filter presets">';
      [['us','US'],['eu','EU'],['needed','Needed only'],['custom','Custom']].forEach(function(p){
	var on = REGION_PRESET === p[0] ? 'true' : 'false';
	filterHtml += '<button type="button" data-region-preset="' + p[0] + '" aria-pressed="' + on + '">' + p[1] + '</button>';
      });
      filterHtml += '</div>';
    }
    //
    for( let attributeKey of ['regions'] ){
      var whitespace = attributeKey == 'regions' ? 'inherit' : 'nowrap';
      if( attributeKey == 'regions' ){
	      filterHtml += '<br/>';
      }
      if( attributeKey == 'regions' ){
	      filterHtml += `<input id="spot_filter_details_toggle" type="button" value="~" data="${SPOT_FILTER_DETAILS_TOGGLE}" style="border:1px solid black; border-radius:5px; margin-right:5px; padding:3px; background-color:grey">`;
      }
      filterHtml += `<span style="border:1px solid grey; border-radius:5px; margin-right:5px; padding-left:3px; padding-right:5px; white-space: ${whitespace}">`;
      var kk = Object.keys(SPOT_ATTRIBUTES[attributeKey]).sort();
      if( attributeKey == 'bands' ){
	kk = kk.sort( (a,b) => {
		var x = a.replace(/(M|cm)$/i, '');
		if( a.match(/cm/i) ){ x /= 1000.0; }
		var y = b.replace(/(M|cm)$/i, '');
		if( b.match(/cm/i) ){ y /= 1000.0; }
		return x - y;
	} );
      }
      var hideForUi = SPOTS_TO_HIDE;
      if( attributeKey == 'regions' && OPTIONS.enableRegionPresets && REGION_PRESET && REGION_PRESET !== 'custom' ){
	hideForUi = regionPresetHideMap(REGION_PRESET, kk, LOCATIONS_HUNTED);
      }
      for ( let k of kk ){
	var style = "";
        if( attributeKey == 'regions' ){
        	if( k.match(/\+\s*\d+/) ){
			continue;
		}
        	if( shouldHighlightUnhuntedRegion(LOCATIONS_HUNTED) ){
        	  var hunted = findInList(LOCATIONS_HUNTED, x => x && x.locationDesc === k );
        	  if( ! hunted ){
			style = "background-color: orange; ";
		  }
        	}
	}
	var slotsHtml = Object.keys(SPOT_ATTRIBUTES[attributeKey][k]).sort().join('\n');
	var checked = hideForUi[k] ? 'CHECKED' : '';
	filterHtml += `&nbsp;&nbsp;<span style="${style}; display:inline-table" title="${slotsHtml}" ><input id="spots_to_hide" type="checkbox" value="${k}" ${checked} /> ${k.replace(/^US-/,'')}`;
	if( attributeKey == 'regions' ){
	  filterHtml += `<br/><span id="spot_filter_details" style="display:${SPOT_FILTER_DETAILS_TOGGLE?'':'none'}">${slotsHtml.replace(/\s+/g,'<br/>')}</span>`;
	}
	filterHtml += `</span>`;
      }
      filterHtml += `</span>`;
    }
    //
    filterHtml += `
	</form>
    `;
    var filterObj = document.getElementById('filter_container');
    var nextFilterSig = [
      OPTIONS.enableRegionPresets ? '1' : '0',
      REGION_PRESET || 'custom',
      Object.keys(SPOT_ATTRIBUTES.regions).sort().join('|'),
      Object.keys(SPOTS_TO_HIDE).filter(function(k){ return SPOTS_TO_HIDE[k]; }).sort().join('|'),
      Array.isArray(LOCATIONS_HUNTED) ? String(LOCATIONS_HUNTED.length) : 'x'
    ].join('#');
    if( filterObj && nextFilterSig !== FILTER_SIG ){
    FILTER_SIG = nextFilterSig;
    filterObj.innerHTML = filterHtml;
    filterObj.style.display = OPTIONS.enableSpotFilters ? '' : 'none';
    Array.from( filterObj.querySelectorAll('input#spots_to_hide') , e => {
      e.addEventListener('click', (e2) => {
	      var k = e2.target.value;
	      var v= e2.target.checked;
	      updateFilterHide(k,v);
      });
    });
    Array.from( filterObj.querySelectorAll('[data-region-preset]') , e => {
      e.addEventListener('click', (e2) => {
	      e2.preventDefault();
	      var next = e2.currentTarget.getAttribute('data-region-preset');
	      if( next === 'custom' && REGION_PRESET !== 'custom' ){
		snapshotPresetHide(Object.keys(SPOT_ATTRIBUTES.regions));
	      }
	      REGION_PRESET = next || 'custom';
	      persistUserRegionFilter();
	      pokeMainTable();
      });
    });
    var filterToggle = document.querySelector('#spot_filter_details_toggle');
    if( filterToggle ){
    filterToggle.addEventListener('click', (e) => {
      var toggle = e.target.getAttribute('data') > 0 ? 0 : 1;
      SPOT_FILTER_DETAILS_TOGGLE = toggle;
      e.target.setAttribute('data', toggle);
      Array.from( document.querySelectorAll('#spot_filter_details') , (e2) => {
	      e2.style.display = toggle ? '' : 'none';
      });
    });
    }
    } else if( filterObj ){
      filterObj.style.display = OPTIONS.enableSpotFilters ? '' : 'none';
    }

    setCurrentCallsignBackground(COLOR1);
    updateHuntKeyMap();
    if( OPTIONS.enableSpotAlerts && (PARKS_HUNTED != null || LOCATIONS_HUNTED != null) ){
      SPOT_ALERT_SEEDED = true;
    }
    observe();
}, 100);
}

// TODO: callsign lookup (DXV, Pathfinder, DXK) ;  needs DDE support in HTTP/DXLab bridge
// // TODO: Prompt for exchanges
// localspots to Spotcollector

var observe = ()=> {
  if( ! observer ){
    return;
  }
  var root = observeRootForPota();
  if( ! root ){
    return;
  }
  observer.observe(root, {
    childList: true,
    subtree: true
  });
};

if( ! window.__POTAPLUS_PAINT_BOUND__ ){
  window.__POTAPLUS_PAINT_BOUND__ = true;
  window.addEventListener('potaplus-paint', function(){
    if( paintSpots ){
      paintSpots();
    }
  });
}

function bindViewPicker(){
  if( window.__POTAPLUS_VIEW_BOUND__ ){
    return;
  }
  var sel = Array.from(document.querySelectorAll('select')).find(function(el){
    return Array.from(el.options || []).some(function(o){ return /^(card|table|list|mapFlat|mapGlobe)$/.test(o.value); });
  });
  if( ! sel ){
    return;
  }
  window.__POTAPLUS_VIEW_BOUND__ = true;
  sel.addEventListener('change', function(){
    FILTER_SIG = '';
    setTimeout(function(){
      detectLayout();
      if( paintSpots ){ paintSpots(); }
    }, 300);
  });
}

function startForegroundObserver() {
  placeToolbar();
  getWidgetHost();
  detectLayout();
  bindViewPicker();
  observe();
  try {
    pokeMainTable();
  } catch (e) {}
  return true;
}

waitForPotaDom(function(){
  if( getPotaRoute() !== 'spots' ){
    hidePotaPlusPageChrome();
    return true;
  }
  placeToolbar();
  detectLayout();
  return !!MAINTABLE;
}, function(){
  if( getPotaRoute() !== 'spots' ){
    hidePotaPlusPageChrome();
    return;
  }
  startForegroundObserver();
});

watchPotaRoute(function(now){
  if( now === 'spots' ){
    showPotaPlusPageChrome();
    detectLayout();
    startForegroundObserver();
    return;
  }
  if( observer ){
    try { observer.disconnect(); } catch (e) {}
  }
  hidePotaPlusPageChrome();
});




function checkKey(e) {
    e = e || window.event;
    if( isTypingTarget(e.target) ){
	return;
    }
    if( (e.key === 'Escape' || e.keyCode == 27) && document.getElementById('potaplus_log_dialog') ){
	closePotaPlusLogDialog();
	if( e.preventDefault ){ e.preventDefault(); }
	if( e.stopPropagation ){ e.stopPropagation(); }
	return false;
    }
    if( potaPlusModalOpen() ){
	return;
    }
    if( OPTIONS && OPTIONS.enableHuntKeys && OPTIONS.enableLogging
	    && (e.key === 'l' || e.key === 'L' || e.keyCode == 76)
	    && ! e.ctrlKey && ! e.shiftKey && ! e.altKey && ! e.metaKey ){
	clickQslForSelected();
	if( e.preventDefault ){ e.preventDefault(); }
	if( e.stopPropagation ){ e.stopPropagation(); }
	return false;
    }
    if( OPTIONS && OPTIONS.enableQsy
	    && ! document.querySelector('.v-overlay--active, .v-dialog--active')
      ){
	// 37=Left, 38=Up, 39=Right, 40=Down
	if( false ){
	} else if (e.keyCode == '37' && ! e.ctrlKey && ! e.shiftKey && ! e.altKey ) { // left arrow
	    startScan(-1);
	    stopScan();
	    if( e.preventDefault ){ e.preventDefault(); }
	    return false;
    	} else if (e.keyCode == '39'  && ! e.ctrlKey && ! e.shiftKey && ! e.altKey ) { // right arrow
	    startScan();
	    stopScan();
	    if( e.preventDefault ){ e.preventDefault(); }
	    return false;
    	} else if ( e.keyCode == '32' &&   e.ctrlKey && ! e.shiftKey && ! e.altKey ) { // ctrl-space
	    var scanBtn = document.getElementById('btn_scan');
	    if( scanBtn ){ scanBtn.click(); }
	    if( e.preventDefault ){ e.preventDefault(); }
	    return false;
	}
    }
}
if( ! window.__POTAPLUS_KEYS_BOUND__ ){
  window.__POTAPLUS_KEYS_BOUND__ = true;
  document.addEventListener('keydown', checkKey, true);
}


whenPotaSessionReady(function(s){
  applyPotaPlusSession(s);
  hidePotaSignInBanner();
  loadLoggedInHunterData();
}, function(s){
  applyPotaPlusSession(s);
  if( MYCALL && TOKEN ){
    hidePotaSignInBanner();
    loadLoggedInHunterData();
    return;
  }
  if( MYCALL ){
    hidePotaSignInBanner();
  }
  if( TOKEN ){
    // Cognito session exists but POTA callsign is not on the cookie/JWT yet.
    if( MAINTABLE ){ try { pokeMainTable(); } catch (e) {} }
    return;
  }
  if( ! MYCALL ){
    showPotaSignInBanner();
  }
  if( MAINTABLE ){ try { pokeMainTable(); } catch (e) {} }
});
} // end __POTAPLUS_FG__ else
