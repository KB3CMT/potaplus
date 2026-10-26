
var MYCALL;
var TOKEN;
var POTA_API_OPTS;

function copyToClipBoard(elementId){
    var content = document.getElementById(elementId).innerHTML;

    navigator.clipboard.writeText(content)
        .then(() => {
//        console.log("Text copied to clipboard...");
	alert("Copied to Clipboard.");
    })
        .catch(err => {
        console.log('Something went wrong', err);
    })
 
}

document.getElementById('n1cc_activator__btn').addEventListener('click', (e) => {
  copyToClipBoard('n1cc_activator__export');
});
document.getElementById('n1cc_hunter__btn').addEventListener('click', (e) => {
  copyToClipBoard('n1cc_hunter__export');
});
document.getElementById('op2op__btn').addEventListener('click', (e) => {
  copyToClipBoard('op2op__export');
});
document.getElementById('earned__btn').addEventListener('click', (e) => {
  copyToClipBoard('earned__export');
});
document.getElementById('earned__btnjson').addEventListener('click', (e) => {
  copyToClipBoard('earned__exportjson');
});
document.getElementById('my_activations__btn').addEventListener('click', (e) => {
  copyToClipBoard('my_activations__export');
});
document.getElementById('my_activations__btnjson').addEventListener('click', (e) => {
  copyToClipBoard('my_activations__exportjson');
});


/////////////////////////////////////////////////////////
async function updateBandsWorked(flag, page, park_num, entry){
	    var size = 100; // seems like size=100 is the max
	    var url = `${POTA_API}/user/logbook?${flag}=1&page=${page}&size=${size}&reference=${park_num}`;
	    if( page == 1 ){
		entry.bandsWorked = entry.bandsWorked || {};
		entry.bandsWorkedStr = entry.bandsWorkedStr || '';
	    }
	    if( Object.keys( entry.bandsWorked || {} ).length == entry.bands ){
		return entry;
	    }
	    return fetch(url, POTA_API_OPTS)
	    .then(response => response.json())
	    .then(data => {
		if( isPotaAuthError(data) || ! data || ! Array.isArray(data.entries) ){
		  return entry;
		}
		data.entries.forEach( (s) => {
		  if( s && s.reference == park_num && s.band ){
		    if( String(s.band).toUpperCase() != "INVALID" ){
		      entry.bandsWorked[ String(s.band).toUpperCase() ] = s.qsoId;
		    }
		  }
		});
		cleanN1ccEntry(entry);
		if( data.entries.length && data.count > page*size && page < 20 && ! entry.cacheComplete ){
		  return updateBandsWorked(flag, page+1, park_num, entry);
		}
		return entry;
	    })
	    .catch(function(){ return entry; });
}
/////////////////////////////////////////////////////////
function displayMY_ACTIVATIONS( divID, rows ){
	var div = document.getElementById(divID);
	var divExport = document.getElementById(divID+'__export');
	var divExportJSON = document.getElementById(divID+'__exportjson');
	rows = parseActivationsPayload(rows);
	div.innerHTML = 'No activations';
	divExport.innerHTML = '';
	divExportJSON.innerText = JSON.stringify( rows || [] );
	if( rows && rows.length ){
	    div.innerHTML = '';
	    var cols = [
		      "date"
		    , "callsign"
		    , "reference"
		    , "name"
		    , "parktypeDesc"
		    , "locationDesc"
		    , "total"
		    , "phone"
		    , "cw"
		    , "data"
	    ];
	    div      .append( cols.join("\t") + "\n" );
	    divExport.append( cols.join(",")  + "\n" );
	    rows.forEach( (row) => {
			var values = cols.map( (s) => row[s] );
	    		div      .append( values.join("\t") + "\n" );
			divExport.append( values.map(s=> s!=null && s.toString().match(/,/) ? `"${s}"` : s ).join(",")  + "\n" );
	    });
	}
}
/////////////////////////////////////////////////////////
function displayN1CC( divID, rows ){
	var div = document.getElementById(divID);
	var divExport = document.getElementById(divID+'__export');
	divExport.innerHTML = '';
	if( ! Array.isArray(rows) || ! rows.length ){
		div.innerHTML = 'No candidates (need at least 3 bands worked)';
		return;
	}
	rows = rows.map(cleanN1ccEntry);
	var bandsSeen = {};
	rows.forEach( (entry) => {
		Object.keys( entry.bandsWorked || {} ).forEach( k => { bandsSeen[k] = 1 } );
	});
	var bandCols = Object.keys( bandsSeen ).sort(compareBands);
	div.innerHTML = '';
	var cols = ["ParkRef", "#Bands", "Bands", "", "Park Name"];
	div      .append( cols.join("\t") + "\n" );
	divExport.append( cols.concat(bandCols).join(",")  + "\n" );
	rows.forEach( (entry) => {
		var values = [
			entry.reference
			, "x" + entry.bands
			, entry.bandsWorkedStr
			, entry.name
		];
		div      .append( values.join("\t") + "\n" );
		var bandValues = bandCols.map( k => entry.bandsWorked[k] ? 1 : '' );
		divExport.append( values.concat(bandValues).map(s=> s!=null && s.toString().match(/,/) ? `"${s}"` : s ).join(",")  + "\n" );
	});
}
var PROGRESS_CTS = {
	activator: { ct: 0, total: 0 },
	hunter:    { ct: 0, total: 0 },
};
function setN1ccStatus(id, msg){
	var el = document.getElementById(id + '__status');
	if( el ){ el.textContent = msg || ''; }
}
async function processN1CC( logType, N1CC_DATA ){
	var progressKey = logType.replace("Only","");
	var list = (N1CC_DATA || []).filter(function(e){ return e && typeof e === 'object'; }).map(cleanN1ccEntry);
	var todo = list.filter(function(e){ return (e.bands || 0) >= 3 && ! e.cacheComplete; })
		.sort(function(a,b){ return (b.bands || 0) - (a.bands || 0); });
	PROGRESS_CTS[progressKey] = { ct: 0, total: todo.length };
	if( ! todo.length ){
		setN1ccStatus('n1cc_'+progressKey, '');
		return list;
	}
	var i = 0;
	async function worker(){
		while( i < todo.length ){
			var idx = i++;
			var entry = todo[idx];
			try {
				await updateBandsWorked(logType, 1, entry.reference, entry);
				cleanN1ccEntry(entry);
			} catch (e) {}
			PROGRESS_CTS[progressKey].ct++;
			setN1ccStatus('n1cc_'+progressKey, 'Band details ' + PROGRESS_CTS[progressKey].ct + ' / ' + PROGRESS_CTS[progressKey].total + ' parks (3+ bands)');
			if( PROGRESS_CTS[progressKey].ct % 8 === 0 ){
				displayN1CC('n1cc_'+progressKey, list);
			}
		}
	}
	var n = Math.min(3, todo.length);
	var workers = [];
	for( var w = 0; w < n; w++ ){ workers.push(worker()); }
	await Promise.all(workers);
	setN1ccStatus('n1cc_'+progressKey, '');
	return list;
}

function popupAuthNeeded(which){
	['n1cc_activator','n1cc_hunter','my_activations'].forEach(function(id){
		var el = document.getElementById(id);
		if( el && /Loading/i.test(el.innerHTML) ){
			el.innerHTML = which || 'Sign in on pota.app, open the spots page once, then reopen this popup.';
		}
	});
}

function init(){
  if( ! MYCALL || ! TOKEN || ! POTA_API_OPTS ){
	    return; // pre-reqs not loaded yet
  }
  //////////////////////
  chrome.runtime.sendMessage({ message: "get__MY_ACTIVATIONS_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
      var cachedRows = cache && cache.data ? parseActivationsPayload(cache.data) : [];
      if( cachedRows.length && cache.updated && youngerThan(cache.updated,20)){
	displayMY_ACTIVATIONS('my_activations', cachedRows);
	return;
      }
    }
    fetch(POTA_API + '/user/activations?all=1', POTA_API_OPTS)
    .then(function(response){ return response.json(); })
    .then(function(data){
	if( isPotaAuthError(data) ){
		document.getElementById('my_activations').innerHTML = 'Not authorized — open pota.app signed in, then reopen this popup.';
		return;
	}
	var rows = parseActivationsPayload(data);
	if( rows.length ){
		chrome.runtime.sendMessage({ message: "set__MY_ACTIVATIONS_cache",  payload: {
			updated: Date.now(),
			data: { activations: rows }
		}  }, function(){});
	}
	displayMY_ACTIVATIONS('my_activations', rows);
    })
    .catch(function(err){
	document.getElementById('my_activations').innerHTML = 'Could not load activations (' + (err && err.message ? err.message : err) + ').';
    });
  });  // get__MY_ACTIVATIONS_cache
  //////////////////////
  chrome.runtime.sendMessage({ message: "get__N1CC_HUNTED_cache" }, response => {
    if (response && response.message === 'success') {
	var cache = response.payload;
	var N1CC_DATA = asUserList(cache && cache.data) || (Array.isArray(cache && cache.data) ? cache.data : []);
	if( isPoisonedEarnedList(N1CC_DATA) ){ N1CC_DATA = []; }
	displayN1CC('n1cc_hunter', N1CC_DATA);
	return;
    }
    document.getElementById('n1cc_hunter').innerHTML = 'No hunter N1CC cache yet. Open the spots page signed in, then reopen this popup.';
  });  // get__N1CC_HUNTED_cache
  //////////////////////
  chrome.runtime.sendMessage({ message: "get__N1CC_ACTIVATOR_cache" }, response => {
    var cachedRows = [];
    if (response && response.message === 'success') {
      var cache = response.payload;
      if( cache && cache.data ){
	cachedRows = asUserList(cache.data) || (Array.isArray(cache.data) ? cache.data.filter(function(e){ return e && typeof e === 'object'; }) : []);
	if( isPoisonedEarnedList(cachedRows) ){ cachedRows = []; }
      }
      if( cachedRows.length && cache.updated && youngerThan(cache.updated,20)){
	cachedRows = cachedRows.map(cleanN1ccEntry);
	displayN1CC('n1cc_activator', cachedRows);
	var incomplete = cachedRows.some(function(e){ return (e.bands || 0) >= 3 && ! e.cacheComplete; });
	if( ! incomplete ){
		return;
	}
      }
    }
    fetch(POTA_API + '/user/award/progress/activator/n1ccmultiband', POTA_API_OPTS)
    .then(function(response){ return response.json(); })
    .then(function(data){
	if( isPotaAuthError(data) ){
		if( ! cachedRows.length ){
			document.getElementById('n1cc_activator').innerHTML = 'Not authorized — open pota.app signed in, then reopen this popup.';
		}
		return;
	}
	var summary = asUserList(data);
	if( ! summary ){
		if( ! cachedRows.length ){
			document.getElementById('n1cc_activator').innerHTML = 'No N1CC activator data.';
		}
		return;
	}
	var byRef = {};
	cachedRows.forEach(function(e){ if( e && e.reference ){ byRef[e.reference] = e; } });
	var N1CC_DATA = summary.map(function(item){
		var prev = byRef[item.reference];
		if( prev ){
			prev.bands = item.bands;
			prev.name = item.name || prev.name;
			return cleanN1ccEntry(prev);
		}
		return cleanN1ccEntry(item);
	});
	displayN1CC('n1cc_activator', N1CC_DATA);
	setN1ccStatus('n1cc_activator', 'Loading band details…');
	chrome.runtime.sendMessage({ message: "set__N1CC_ACTIVATOR_cache", payload: {updated:Date.now(), data:N1CC_DATA} }, function(){});
	processN1CC('activatorOnly', N1CC_DATA).then(function(done){
		chrome.runtime.sendMessage({ message: "set__N1CC_ACTIVATOR_cache", payload: {updated:Date.now(), data:done} }, function(){});
		displayN1CC('n1cc_activator', done);
	});
    })
    .catch(function(err){
	if( ! cachedRows.length ){
		document.getElementById('n1cc_activator').innerHTML = 'Could not load N1CC activator list (' + (err && err.message ? err.message : err) + ').';
	}
    });
  });  // get__N1CC_ACTIVATOR_cache
  //////////////////////
}


///////////////////////////////
// main()
///////////////////////////////
var gotCall = false;
var gotToken = false;
var gotApi = false;
function tryInit(){
  if( ! gotCall || ! gotToken || ! gotApi ){
    return;
  }
  if( ! MYCALL || ! TOKEN ){
    popupAuthNeeded();
    return;
  }
  POTA_API_OPTS = getPotaApiOpts(TOKEN);
  init();
}
chrome.runtime.sendMessage({ message: "get__MYCALL" }, response => {
  gotCall = true;
  if (response && response.message === 'success') {
    MYCALL = response.payload;
  }
  tryInit();
});
chrome.runtime.sendMessage({ message: "get__TOKEN" }, response => {
  gotToken = true;
  if (response && response.message === 'success') {
    TOKEN = response.payload;
  }
  tryInit();
});
// The stored token belongs to whichever site (pota.app or dev.pota.app) saved it last.
chrome.runtime.sendMessage({ message: "get__POTA_API" }, response => {
  gotApi = true;
  if (response && response.message === 'success' && response.payload === 'https://devapi.pota.app') {
    POTA_API = response.payload;
  }
  tryInit();
});
var OPS_HUNTED;
chrome.runtime.sendMessage({ 
        message: "get__OPS_HUNTED"
      }, response => {
      if (response && response.message === 'success') {
	OPS_HUNTED = response.payload;
	var div = document.getElementById("op2op");
	div.innerHTML = 'No candidates. Open the spots page signed in and use QSY or QSL; Op-to-Op counts on pota.app are the live source, and this list is only a leftover cache.';
	var divExport = document.getElementById("op2op__export");
	divExport.innerHTML = '';
	//console.log( OPS_HUNTED);
	if(Object.keys(OPS_HUNTED).length){
	    div.innerHTML = '';
	    var cols = ["#QSOs", "Callsign", "POTA UserID", "Other Callsigns"];
	    div      .append( cols.join("\t") + "\n" );
	    divExport.append( cols.join(",")  + "\n" );
	    // note: older cached date might not have "bio"
	    Object.keys(OPS_HUNTED)
		.filter( call => ! OPS_HUNTED[call].bio || OPS_HUNTED[call].bio.callsign == call )
		.filter( call => OPS_HUNTED[call].ct >= 5 )
		.sort( (a,b) => { var aa=OPS_HUNTED[a].ct; var bb=OPS_HUNTED[b].ct; return aa<bb?1 : aa==bb ? 0 : -1 } ) // ORDER BY ct DESC
		.forEach( (call) => {
			var bio = OPS_HUNTED[call].bio || { "callsign": call, "id":'', "other_callsigns":[] };
			var values = [ OPS_HUNTED[call].ct, bio.callsign, bio.id, bio.other_callsigns.join(",") ];
	    		div      .append( values.join("\t") + "\n" );
			divExport.append( values.map(s=> s.toString().match(/,/) ? `"${s}"` : s ).join(",")  + "\n" );
		})
	    ;
	}
      }
});

  chrome.runtime.sendMessage({ message: "get__MYAWARDS_EARNED_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
      var MYAWARDS_EARNED = parseEarnedCachePayload(cache);
//  [ {"activeCallsign": "K2DW", "dateGranted": "2022-05-22T06:55:00", "awardName": "Silver Activator", "awardDescription": "Working from 20 different units", "badgeNum": null, "endorsements": "PHONE", "reference": null, "parkName": null, "operator": null, "radarDate": null, "additionalDetails": null}, ... ]	   
	var div = document.getElementById("earned");
	div.innerHTML = 'No data. Ensure that "Enable My Awards" option is on.';
	var divExport = document.getElementById("earned__export");
	divExport.innerHTML = '';
	var divExportJSON = document.getElementById("earned__exportjson");
	divExportJSON.innerText = JSON.stringify( MYAWARDS_EARNED['curr'] );
	if( MYAWARDS_EARNED['curr'] && MYAWARDS_EARNED['curr'].length ){
	    div.innerHTML = '';
	    var cols = [
		    "dateGranted"
		    , "activeCallsign"
		    , "awardName"
		    , "awardDescription"
		    , "badgeNum"
		    , "endorsements"
		    , "reference"
		    , "parkName"
		    , "operator"
		    , "operatorCallsign"
		    , "operatorName"
		    , "detail"
		    , "radarDate"
		    , "additionalDetails"
	    ];
	    div      .append( cols.join("\t") + "\n" );
	    divExport.append( cols.join(",")  + "\n" );
	    MYAWARDS_EARNED['curr'].forEach( (row) => {
			var values = cols.map( (s) => row[s] );
	    		div      .append( values.join("\t") + "\n" );
			divExport.append( values.map(s=> s!=null && s.toString().match(/,/) ? `"${s}"` : s ).join(",")  + "\n" );
	    });
	}
    }
  });

