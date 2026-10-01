
if (window.__POTAPLUS_PROFILE__) {
  console.log('POTAPlus profile already loaded');
} else {
window.__POTAPLUS_PROFILE__ = true;


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
}

sendChromeMessage("set__MYCALL", MYCALL);
sendChromeMessage("set__TOKEN", TOKEN);

var POTA_API_OPTS = getPotaApiOpts(TOKEN);

var CELLS = Array.from( document.querySelectorAll('.col-sm-4, .col-md-3, .col-lg-2, .col-xl-1, .col-6, .v-col, .v-col-sm-4, .v-col-md-3, .v-col-lg-2, .v-col-xl-1') );
var MAINTABLE = (CELLS[0] && CELLS[0].parentElement) || document.querySelector('.v-row') || document.querySelector('main') || document.body;
var DARKMODE = isPotaDarkMode();


var PROFILE_CALL = '';
var pathMatch = getPotaPath().match(/\/profile\/([^/?#]+)/);
var hashMatch = (document.location.hash || '').match(/#\/profile\/(.+)/);
PROFILE_CALL = decodeURIComponent((pathMatch && pathMatch[1]) || (hashMatch && hashMatch[1]) || '');

var MYAWARDS_EARNED = null;
var PROFILE_INFO = null;


if( PROFILE_CALL ){
  // Public profile payload does not require sign-in.
  if( MYAWARDS_EARNED == null ){ MYAWARDS_EARNED = {}; }
  loadPublicProfileInfo();
}
if( MYCALL && PROFILE_CALL){
  loadLoggedInProfileData();
} else if( ! MYCALL ){
  whenPotaSessionReady(function(s){
    applyPotaPlusSession(s);
    loadLoggedInProfileData();
  }, function(s){
    applyPotaPlusSession(s);
    if( MYCALL ){
      loadLoggedInProfileData();
      return;
    }
    if( MYAWARDS_EARNED == null ){ MYAWARDS_EARNED = {}; }
    if( ! PROFILE_INFO ){ loadPublicProfileInfo(); }
  });
}

function loadPublicProfileInfo(){
  if( ! PROFILE_CALL || PROFILE_INFO ){
    return;
  }
  fetch('https://api.pota.app/profile/' + PROFILE_CALL, POTA_API_OPTS)
    .then(function(response){ return response.json(); })
    .then(function(data){
      PROFILE_INFO = data || {};
      if( MYAWARDS_EARNED == null ){ MYAWARDS_EARNED = {}; }
      if( MAINTABLE ){ try { pokeMainTable(); } catch (e) {} }
    })
    .catch(function(err){
      console.log('POTAPlus profile fetch:', err);
      PROFILE_INFO = PROFILE_INFO || {};
      if( MYAWARDS_EARNED == null ){ MYAWARDS_EARNED = {}; }
    });
}

function loadLoggedInProfileData(){
  if( ! MYCALL || ! PROFILE_CALL || window.__POTAPLUS_PROFILE_LOADED__ ){
    return;
  }
  window.__POTAPLUS_PROFILE_LOADED__ = true;
  ////////
  chrome.runtime.sendMessage({ message: "get__MYAWARDS_EARNED_cache" }, response => {
    if (response && response.message === 'success') {
      var cache = response.payload;
      try {
        MYAWARDS_EARNED = cache && cache.data ? (typeof cache.data === 'string' ? JSON.parse(cache.data) : cache.data) || {} : {};
      } catch (e) {
        MYAWARDS_EARNED = {};
      }
      if( MAINTABLE ){ try { pokeMainTable(); } catch (e) {} }
    } else if( MYAWARDS_EARNED == null ){
      MYAWARDS_EARNED = {};
    }
  });  // get__MYAWARDS_EARNED_cache
  ////////
  loadPublicProfileInfo();
  ////////
} // loadLoggedInProfileData




var observer;
if( observer == null ){
observer = new MutationObserver(mutations => {
    var route = getPotaRoute();
    if( route == "spots" ){
	console.log("Switched to SPOTS page");
	document.location.reload();
	return;
    }
    if( route == "activations" ){
	console.log("Switched to ACTIVATIONS page");
	document.location.reload();
	return;
    }
    if( route != "profile" ){
	console.log("NO LONGER ON PROFILE PAGE");
	try { observer.disconnect(); } catch (e) {}
	return;
    }
    if( false
		|| MYAWARDS_EARNED == null
		|| PROFILE_INFO == null
    	){
	    // skip while still loading/initializing the async-fetch of dependencies
	    console.log("LOADING:"
		, 'MYAWARDS_EARNED: '   + (MYAWARDS_EARNED   ? 'Y' : '-')
		, 'PROFILE_INFO: '      + (PROFILE_INFO      ? 'Y' : '-')
	    );
	    return;
    }

    observer.disconnect(); // turn observer off;

    // next.pota.app already shows earned awards (dates, endorsements, certificates)
    // on /user/achievements/earned and on the profile. Injecting into every .v-col / <p>
    // fights Vue 3's list and empties or duplicates that table.
    if( isNextPota() ){
	observe();
	return;
    }

    CELLS = Array.from( document.querySelectorAll('.col-sm-4, .col-md-3, .col-lg-2, .col-xl-1, .col-6') ).filter(function(cell){
	return cell.querySelector('.award-name') || (cell.querySelector('img') && cell.querySelector('p'));
    });
    if( CELLS.length ){
      MAINTABLE = CELLS[0].parentElement;
    }

    var awards = (PROFILE_INFO && Array.isArray(PROFILE_INFO.awards)) ? PROFILE_INFO.awards : [];
    for (let cell of CELLS) {
	    if( cell.innerHTML.match(/AWARD_DETAILS/) ){
		    continue;
	    }
	    var awardNameObj = cell.querySelector('.award-name') || cell.querySelector('p');
	    if( ! awardNameObj ){
		    continue;
	    }
	    var awardName = (awardNameObj.innerText || '').trim();
	    var awardInfo = awards.find( e => e.name == awardName );
	    if( ! awardInfo ){
		    continue;
	    }
	    var x = document.createElement('div');
	    x.setAttribute('data-marker','AWARD_DETAILS');
	    x.innerHTML = `
	    	${(awardInfo.granted || '').replace(/-\d\dT.+/,'')} <br/>
		${(awardInfo.endorsements || []).join(", ")}
	    `;
	    awardNameObj.append(x);
    } // let cell

    ///////////////////////////////////////

//-------------------------------------

    observe(); // turn back on 
}); // new MutationObserver
}

var observe = ()=> {
  if( ! MAINTABLE || ! observer ){
    return;
  }
  observer.observe(MAINTABLE, {
    childList: true,
    characterData: true,
    subtree: true,
  });
};
waitForPotaDom(function(){
  if( getPotaRoute() !== 'profile' ){
    return true;
  }
  CELLS = Array.from( document.querySelectorAll('.award-name, .col-sm-4, .col-md-3, .col-lg-2, .col-xl-1, .col-6') );
  var awardCell = document.querySelector('.award-name, .profile-section-card img');
  if( CELLS[0] ){
    MAINTABLE = CELLS[0].parentElement;
  } else if( awardCell ){
    MAINTABLE = awardCell.closest('.v-row') || awardCell.closest('.profile-section-card') || document.querySelector('main');
  } else if( ! isNextPota() ){
    MAINTABLE = document.querySelector('main') || document.querySelector('#app');
  }
  return !!MAINTABLE || isNextPota();
}, function(){
  if( getPotaRoute() !== 'profile' ){
    return;
  }
  if( isNextPota() ){
    return;
  }
  observe();
  if (MAINTABLE) {
    try { pokeMainTable(); } catch (e) {}
  }
});
watchPotaRoute(function(now){
  if( now === 'profile' ){
    return;
  }
  if( observer ){
    try { observer.disconnect(); } catch (e) {}
  }
  if( now === 'spots' || now === 'activations' ){
    document.location.reload();
  }
});
} // end __POTAPLUS_PROFILE__ else
