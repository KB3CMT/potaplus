
if (window.__POTAPLUS_ACT__) {
  console.log('POTAPlus activations already loaded');
} else {
window.__POTAPLUS_ACT__ = true;


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
  console.log("MYCALL: ", MYCALL);
  if( MYCALL ){
    sendChromeMessage("set__MYCALL", MYCALL);
    sendChromeMessage("set__TOKEN", TOKEN);
    sendChromeMessage("set__POTA_API", POTA_API);
  }
}

sendChromeMessage("set__MYCALL", MYCALL);
sendChromeMessage("set__TOKEN", TOKEN);
sendChromeMessage("set__POTA_API", POTA_API);

var MAINTABLE;
var CARDMODE;
var LISTMODE;
var DARKMODE;

function detectLayout() {
  var layout = detectPotaLayout();
  MAINTABLE = layout.MAINTABLE;
  CARDMODE = layout.CARDMODE;
  LISTMODE = layout.LISTMODE;
  DARKMODE = layout.DARKMODE;
}

var OPTIONS = null;
var LATESTVER = '';
var VERSION_CHECK = '';

detectLayout();


chrome.runtime.sendMessage({ 
        message: "get__options"
      }, response => {
      if (response && response.message === 'success') {
	OPTIONS = setOptionsDefaults( response.payload );
	if (MAINTABLE) {
	  pokeMainTable(); // touch, to trigger initial update
	}
      }
});

var WAS_HUNTED = null;
var PARKS_HUNTED = null;
var ACTIVATIONS = null;
var LOCATIONS_HUNTED = null;

if( MYCALL){
  loadLoggedInActivationData();
} else {
  whenPotaSessionReady(function(s){
    applyPotaPlusSession(s);
    loadLoggedInActivationData();
  }, function(s){
    applyPotaPlusSession(s);
    if( MYCALL ){
      loadLoggedInActivationData();
      return;
    }
    if( MAINTABLE ){ try { pokeMainTable(); } catch (e) {} }
  });
}

function loadLoggedInActivationData(){
  if( ! MYCALL || window.__POTAPLUS_ACT_LOADED__ ){
    return;
  }
  window.__POTAPLUS_ACT_LOADED__ = true;
  ////////
  chrome.runtime.sendMessage({ message: "get__LOCATIONS_HUNTED_cache" }, response => {
    if (response && response.message === 'success') {
	var cache = response.payload;
	LOCATIONS_HUNTED = cache.data;	// use cached
	if( isPoisonedEarnedList(LOCATIONS_HUNTED) ){ LOCATIONS_HUNTED = []; }
	pokeMainTable(); // touch, to trigger initial update
    }
  });  // get__LOCATIONS_HUNTED_cache
  ////////
  chrome.runtime.sendMessage({ message: "get__WAS_HUNTED_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
	WAS_HUNTED = cache.data;	// use cached
	if( isPoisonedEarnedList(WAS_HUNTED) ){ WAS_HUNTED = []; }
	pokeMainTable(); // touch, to trigger initial update
    }
  });  // get__WAS_HUNTED_cache
  ////////
  chrome.runtime.sendMessage({ message: "get__PARKS_HUNTED_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
	PARKS_HUNTED = cache.data;	// use cached
	if( isPoisonedEarnedList(PARKS_HUNTED) ){ PARKS_HUNTED = []; }
	pokeMainTable(); // touch, to trigger initial update
    }
  });  // get__PARKS_HUNTED_cache
  ////////
} // loadLoggedInActivationData




var observer;
var paintActivations;
if( observer == null ){
observer = new MutationObserver(function(mutations){
    if( ! mutationsAffectSpots(mutations) ){
	return;
    }
    if( paintActivations ){
	paintActivations();
    }
});
paintActivations = debounceFn(function(){
    var route = getPotaRoute();
    if( route != "activations" ){
	try { observer.disconnect(); } catch (e) {}
	return;
    }
    detectLayout();
    if( ! MAINTABLE ){
	return;
    }

    if( OPTIONS == null ){
	    return;
    }

    observer.disconnect();

    var rows = LISTMODE
		? Array.from(MAINTABLE.rows || [])
		: Array.from( MAINTABLE.querySelectorAll('[data-spot-activator], .v-card, div.v-card.v-sheet') )
    ;

    for (let row of rows) {
      var cells = LISTMODE ? row.cells : Array.from( row.querySelectorAll("div.v-list-item") );
      var objs;
      if( LISTMODE ){
	var cmap = mapTableColumns(row.closest('table'), ACTIVATION_COLUMN_ALIASES);
	if( true ){
	  objs = {
	    call:		cellAt(row, cmap.call) || cells[2] || cells[0],
	    park_num:		cellAt(row, cmap.park_num) || cells[3] || cells[1],
	    park_name:		cellAt(row, cmap.park_num) || cells[3] || cells[1],
	    park_region:	cellAt(row, cmap.park_region) || cells[4] || cells[2],
	    comments:		cellAt(row, cmap.comments) || cells[6],
	  };
	} else {
	  objs = {
	    call: cells[2],
	    park_num: cells[3],
	    park_name: cells[3],
	    park_region: cells[4],
	    comments: cells[6],
	  };
	}
      } else {
	objs = {
	  call: ( cardTitle(row)
			
			|| row.querySelector('.pota-mono')
		),
	  park_num:	( row.querySelector('a[href^="/park/"] .pota-mono') || row.querySelector('.pota-mono') ),
	  park_name:	(cells[0] ),
	  park_region:	(cells[1] ),
	  comments:	(cells[5] || cells[4] ),
	};
      }

      if( !objs.call ) {
            console.log("ERROR -- no objs.call", objs);
	    continue;
      }
      if( !objs.park_num && !parseParkReference(row.innerText) ) {
	    continue;
      }
      var call = (objs.call && objs.call.innerText ? objs.call.innerText : row.innerText).trim().split(/\s+/)[0];
      var park_num = objs.park_num && objs.park_num.innerText ? objs.park_num.innerText.trim() : '';
      var parsedRef = parseParkReference(park_num) || parseParkReference(row.innerText);
      if( parsedRef ){
	      park_num = parsedRef;
      }
      var park_name = (objs.park_name && objs.park_name.innerText ? objs.park_name.innerText : '').trim().replaceAll('"',"'");
	    	// todo escape a "&"
      park_name = normalizeParkName(park_name, false);
      var park_region = (objs.park_region ? objs.park_region.innerText : '').replace(/\n.+/,'').trim();
      park_region = park_region.replace(/(0|\d+\/\d+)$/,'').trim(); // CARDMODE hack
      var park_program = park_region.replace(/-.+/,'');
      if( LISTMODE ){
	      park_num = park_num.replace(/\s.+/, '');
      }
      if( CARDMODE ){
	      park_num = parsedRef || park_num.replace(/.+ @\s*/, '');
	      park_name = normalizeParkName(park_name, true);
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
	  }
	  objs.badges.style.fontFamily='monospace';
	  objs.badges.innerHTML = '';
	  if( objs.park_num ){
	    objs.park_num.append(objs.badges);
	  } else {
	    row.append(objs.badges);
	  }
    }

    ///////////////////////////////////////

//-------------------------------------
    if( OPTIONS.enableNeededLocations && LOCATIONS_HUNTED && objs.park_region && ! objs.park_region.innerHTML.match(/LOCATIONS_HUNTED/) ){
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
	  objs.park_region.append(badge);
        }
      }
    } // OPTIONS.enableNeededLocations

//-------------------------------------
    if( OPTIONS.enableNeededWAS && WAS_HUNTED && objs.park_region && ! objs.park_region.innerHTML.match(/WAS_HUNTED/) ){
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
	  objs.park_region.append(badge);
        }
      }
    } // OPTIONS.enableNeededWAS

//-------------------------------------
    if( OPTIONS.enableNeededParks && PARKS_HUNTED && ! objs.park_num.innerHTML.match(/PARKS_HUNTED/) ){
      if(PARKS_HUNTED.length){
        var hunted = findInList(PARKS_HUNTED, x => x && x.reference === park_num );
	var badge = document.createElement('span');
	badge.setAttribute('data-marker','PARKS_HUNTED');
	badge.classList.add('v-badge__badge');
	badge.style.position = 'relative';
	badge.style.marginRight = '5px';
        if( hunted != null ){
	  badge.classList.add(
		  hunted.qsos >= 20 ? 'grey'
		:                     'accent'
	  );
	  badge.setAttribute('title', `Total QSOs with ${park_num}`);
	  badge.innerHTML = `${hunted.qsos}`;
          objs.badges.append(badge);
        }else if( ! OPTIONS.enableNeededLocations ){
	  badge.classList.add('warning');
	  badge.setAttribute('title', `No QSOs with ${park_num}`);
	  badge.innerHTML = `0`; // atno
          objs.badges.append(badge);
        }
      }
    } // OPTIONS.enableNeededParks

//-------------------------------------


  } // rows	    


    observe();
}, 100);
}

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
if( ! window.__POTAPLUS_ACT_PAINT_BOUND__ ){
  window.__POTAPLUS_ACT_PAINT_BOUND__ = true;
  window.addEventListener('potaplus-paint', function(){
    if( paintActivations ){
      paintActivations();
    }
  });
}
waitForPotaDom(function(){
  if( getPotaRoute() !== 'activations' ){
    return true;
  }
  detectLayout();
  return !!MAINTABLE;
}, function(){
  if( getPotaRoute() !== 'activations' ){
    return;
  }
  detectLayout();
  observe();
  pokeMainTable();
});
watchPotaRoute(function(now){
  if( now === 'activations' ){
    detectLayout();
    observe();
    pokeMainTable();
    return;
  }
  if( observer ){
    try { observer.disconnect(); } catch (e) {}
  }
});
} // end __POTAPLUS_ACT__ else
