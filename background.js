/*
POTAPlus browser extension for POTA.app

Author: David Westbrook K2DW
Contact: dwestbrook@gmail.com or K2DW on POTA Slack workspace.

Support: Direct message or #proj-potaplus-browser-extension channel on POTA Slack workspace

Source & Documentation:
	https://dwestbrook.net/projects/potaplus
*/


importScripts( './include/lz-string.min.js' );  // https://pieroxy.net/blog/pages/lz-string/index.html

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('options', data => {
    if (chrome.runtime.lastError) {
		return;
    }
    if( data['options'] && data['options'].hasOwnProperty('enableLogging') ){
	return;
    }
    // "options" key didn't exist, so create defaults.
    chrome.storage.local.set({
	name: "Jack",
	selectedcall: "0E0=NONE=0E0",
	options: {
		enableNeededWAS: true,
		enableNeededParks: true,
		enableNeededN1CC: true,
		enableNeededOps: true,
		enableMyAwards: true,
		//
		enableSpotFilters: true,
		enableSpotTimeAbbrv: false,
		enableHideSpotterCall: false,
		enableHideSpotterComment: false,
		//
		enableIconQRZ: true,
		enableIconRBN: true,
		enableIconPSKReporter: true,
		//
		enableQsy: false,
		qsyConfig: {
			proto: 'http',
			host: 'localhost',
			port: 8073,
			method: '', // commander, omnirig, aclog
			dataMode: 'USB', // USB, DATA-U
			cwMode: 'CW', // might be CW-U or CW-L for omnirig
			target_host: '', // default localhost; For OmniRig: OLE Object ID
			target_port: '', // varies by application; For OmniRig: Rig1 or Rig2 
		},
		enableLogging: false,
		loggingConfig: {
			proto: 'http',
			host: 'localhost',
			port: 8073,
			method: '', // dxkeeper, log4om, aclog, logger32
			autoReSpot: true,
			// http://www.dxlabsuite.com/dxkeeper/Help/Items.htm
			parkNumADIFField: null, // App_DXKeeper_User_Defined_0
			additionalADIFFields: {}, // App_DXKeeper_My_QTHID, STATION_CALLSIGN
			target_host: '', // default localhost
			target_port: '', // varies by application
			target_apikey: '',
		},
		enableRotor: false,
		rotorConfig: {
			proto: 'http',
			host: 'localhost',
			port: 8073,
			method: '', // pst
			target_host: '', // default localhost
			target_port: '', // varies by application
		},
	},
    });
  });
});

function potaPageType(url) {
  if (!url) {
    return null;
  }
  try {
    var u = new URL(url);
    if (!/^(www\.)?pota\.app$|^next\.pota\.app$/.test(u.hostname)) {
      return null;
    }
    var path = (u.hash && u.hash.indexOf('#/') === 0) ? u.hash.slice(1) : (u.pathname || '/');
    if (/^\/activations/.test(path)) {
      return 'activations';
    }
    if (/^\/profile\//.test(path)) {
      return 'profile';
    }
    if (path === '/' || path === '') {
      return 'foreground';
    }
    return null;
  } catch (e) {
    return null;
  }
}

function injectPotaPlus(tabId, filebase) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    world: 'MAIN',
    files: ['include/potaplus-page-bridge.js']
  }).catch(err => console.log('POTAPlus page bridge:', err));

  chrome.scripting.insertCSS({
    target: { tabId: tabId },
    files: ["./"+filebase+"_styles.css" ]
  })
    .then(() => {
      console.log("INJECTED THE "+filebase+" STYLES.");
      return chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: [
          "include/lz-string.min.js",
          "include/potaplus-util.js",
          "./"+filebase+".js"
        ]
      });
    })
    .then(() => {
      console.log("INJECTED THE "+filebase+" SCRIPT.");
    })
    .catch(err => console.log(err));
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab && tab.url && potaPageType(tab.url) ) {
	var filebase = potaPageType(tab.url);
        injectPotaPlus(tabId, filebase);
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message.match(/^get__/)) {
	var k = request.message.replace('get__','');
        chrome.storage.local.get([k, "_lz_"+k], data => {
//console.log("========- GET", k, data);
            if (chrome.runtime.lastError) {
                sendResponse({
                    message: 'fail'
                });
                return;
            }
            sendResponse({
                message: 'success',
		name:k,
//                payload: data[k]
		payload: data["_lz_"+k]
		    	? JSON.parse( LZString.decompressFromUTF16(data["_lz_"+k]) ) // TDOD .. doesn't seem to work
		    	: data[k]
            });
        });

        return true;
    } else if (request.message.match(/^set__/)) {
	var k = request.message.replace('set__','');
	chrome.storage.local.remove("_lz_"+k, () => { if (chrome.runtime.lastError) {} } ); // to clear out compressed
//console.log("========- SET", k, request.payload);
        chrome.storage.local.set({
            [k]: request.payload
        }, () => {
            if (chrome.runtime.lastError) {
		console.log(`ERROR -- FAILED TO SET '${k}': ${chrome.runtime.lastError.message}`);
                sendResponse({ message: 'fail', error: chrome.runtime.lastError });
                return;
            }
            sendResponse({ message: 'success' });
        })
        return true;
    } else if (request.message.match(/^zset__/)) {
	var k = request.message.replace('zset__','');
console.log("SET COMPRESSED:", k, JSON.stringify(request.payload).length, "=>", LZString.compressToUTF16( JSON.stringify(request.payload) ).length );
	chrome.storage.local.remove(k, () => { if (chrome.runtime.lastError) {} } ); // to clear out uncompressed
        chrome.storage.local.set({
		["_lz_"+k]: LZString.compressToUTF16( JSON.stringify(request.payload) )
        }, () => {
            if (chrome.runtime.lastError) {
		console.log(`ERROR -- FAILED TO SET =COMPRESSED= '${k}': ${chrome.runtime.lastError.message}`);
                sendResponse({ message: 'fail', error: chrome.runtime.lastError });
                return;
            }
            sendResponse({ message: 'success' });
        })
        return true;
    } else if (request.message === 'fetch_json') {
	var url = request.url;
	if( ! url || typeof url !== 'string' || !/^https:\/\/services\.swpc\.noaa\.gov\//i.test(url) ){
	    sendResponse({ message: 'fail', error: 'url' });
	    return;
	}
	fetch(url)
	  .then(function(r){
	    return r.json().then(function(data){
	      sendResponse({ message: 'success', ok: r.ok, status: r.status, payload: data });
	    });
	  })
	  .catch(function(err){
	    sendResponse({ message: 'fail', error: String(err) });
	  });
	return true;
    }

    if (request.message === 'get_name') {
        chrome.storage.local.get('name', data => {
            if (chrome.runtime.lastError) {
                sendResponse({
                    message: 'fail'
                });

                return;
            }

            sendResponse({
                message: 'success',
                payload: data.name
            });
        });

        return true;
    } else if (request.message === 'change_name') {
        chrome.storage.local.set({
            name: request.payload
        }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ message: 'fail' });
                return;
            }

            sendResponse({ message: 'success' });
        })

        return true;
    }
});
