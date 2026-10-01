
var OPTIONS = null;

function writeOptions(){
	if( ! OPTIONS ){
		return;
	}
        chrome.runtime.sendMessage({ 
            message: "set__options",
            payload: OPTIONS
          }, response => {
            if (response && response.message === 'success') {
            }
        });
}

function wireUpConfigChecked (elementId, cfgCat, cfgKey) {
	var input = document.getElementById(elementId);
	input.checked = cfgCat ? OPTIONS[cfgCat][cfgKey] : OPTIONS[cfgKey];
	input.addEventListener('change', (e) => {
	  if( cfgCat ){
	    OPTIONS[cfgCat][cfgKey] = input.checked;
	  }else{
	    OPTIONS[cfgKey] = input.checked;
	  }
	  writeOptions();
        });
}

function wireUpConfigValue (elementId, cfgCat, cfgKey) {
//console.log('WIRE', elementId, cfgCat, cfgKey);
	var input = document.getElementById(elementId);
	if(elementId == 'log_additionalADIFFields'){
	  input.value = '';
	  Object.keys( OPTIONS[cfgCat][cfgKey] ).forEach(function (key){
	    var value = OPTIONS[cfgCat][cfgKey][key];
	    input.value += key + "=" + value + "\n";
	  });
	}else{
	  var v = OPTIONS[cfgCat][cfgKey];
	  input.value = (typeof v === 'undefined') ? '' : v;
	}
	input.addEventListener('change', (e) => {
	  input.value = input.value.trim();
	  if(elementId == 'qsy_method'){
	    OPTIONS[cfgCat][cfgKey] = input.value;
	    OPTIONS.enableQsy = input.value ? true : false;
	    document.getElementById('qsy_details').style.display = input.value ? '' : 'none';
	  }else if(elementId == 'rotor_method'){
	    OPTIONS[cfgCat][cfgKey] = input.value;
	    OPTIONS.enableRotor = input.value ? true : false;
	    document.getElementById('rotor_details').style.display = input.value ? '' : 'none';
	  }else if(elementId == 'log_method'){
	    OPTIONS[cfgCat][cfgKey] = input.value;
	    OPTIONS.enableLogging = input.value ? true : false;
	    document.getElementById('log_details').style.display = input.value ? '' : 'none';
	    var isHamAppsProxy = input.value == 'qrz' ? false : true;
	    document.getElementById('logTargetApi').style.display = isHamAppsProxy ? 'none' : ''    ;
	    document.getElementById('logTargetApp').style.display = isHamAppsProxy ? ''     : 'none';
	    document.getElementById('logHamAppsProxy').style.display = isHamAppsProxy ? ''     : 'none';
	  }else if(elementId == 'log_additionalADIFFields'){
	    OPTIONS[cfgCat][cfgKey] = {};
	    input.value.split("\n").forEach( (s)=>{
		    var x = s.split('=');
		    if( x[0] ){
		      OPTIONS[cfgCat][cfgKey][ x[0] ] = x[1];
		    }
	    });
	  }else{
	    OPTIONS[cfgCat][cfgKey] = input.value;
	  }
	  writeOptions();
        });
}

chrome.runtime.sendMessage({ 
    message: "get__options"
  }, response => {
    if (response && response.message === 'success') {
	OPTIONS = response.payload;
	if(!OPTIONS.enableQsy    ){ OPTIONS.qsyConfig.method     = ''; }
	if(!OPTIONS.enableLogging){ OPTIONS.loggingConfig.method = ''; }
    	if( ! OPTIONS.hasOwnProperty('enableNeededOps') ){
	  OPTIONS.enableNeededOps = true;
	}
    	if( ! OPTIONS.hasOwnProperty('enableNeededLocations') ){
	  OPTIONS.enableNeededLocations = true;
	}
    	if( ! OPTIONS.hasOwnProperty('enableSpotFilters') ){
	  OPTIONS.enableSpotFilters = true;
	}
    	if( ! OPTIONS.hasOwnProperty('enableMyAwards') ){
	  OPTIONS.enableMyAwards = true;
	}
    	if( ! OPTIONS.hasOwnProperty('enableRotor') ){
	  OPTIONS.enableRotor = false;
	  OPTIONS.rotorConfig = {
		proto: 'http',
		host: 'localhost',
		port: 8073,
		method: '', // pst
		target_host: '', // default localhost
		target_port: '', // varies by application
	  };
	}
console.log('OPTIONS', JSON.stringify(OPTIONS,null,2) );

	if( OPTIONS.loggingConfig.parkNumADIFField && ! OPTIONS.loggingConfig.parkNumADIFField.match('__DEPRECATED__') ){
		OPTIONS.loggingConfig.parkNumADIFField.trim().split(/[, ]+/).forEach(k=> {
			OPTIONS.loggingConfig.additionalADIFFields[k] = '%PARKREF%';
		});
		OPTIONS.loggingConfig.parkNumADIFField = '__DEPRECATED__,' + OPTIONS.loggingConfig.parkNumADIFField;
	}

	wireUpConfigValue('log_method',		'loggingConfig','method');
	wireUpConfigValue('log_host',		'loggingConfig','host');
	wireUpConfigValue('log_port',		'loggingConfig','port');
	wireUpConfigValue('log_proto',		'loggingConfig','proto');
	wireUpConfigValue('log_target_apikey',	'loggingConfig','target_apikey');
	wireUpConfigValue('log_target_host',	'loggingConfig','target_host');
	wireUpConfigValue('log_target_port',	'loggingConfig','target_port');
//	wireUpConfigValue('log_parkNumADIFField','loggingConfig','parkNumADIFField');
	wireUpConfigValue('log_homeQTH',	'loggingConfig','homeQTH');
	wireUpConfigValue('log_homeGrid',	'loggingConfig','homeGrid');
	wireUpConfigChecked('log_forceRefresh',	'loggingConfig','forceRefresh');
//	wireUpConfigChecked('log_autoReSpot',	'loggingConfig','autoReSpot');

	wireUpConfigValue('qsy_method',	'qsyConfig','method');
	wireUpConfigValue('qsy_host',	'qsyConfig','host');
	wireUpConfigValue('qsy_port',	'qsyConfig','port');
	wireUpConfigValue('qsy_proto',	'qsyConfig','proto');
	wireUpConfigValue('qsy_target_host',	'qsyConfig','target_host');
	wireUpConfigValue('qsy_target_port',	'qsyConfig','target_port');
	wireUpConfigValue('qsy_dataMode','qsyConfig','dataMode');
	wireUpConfigValue('qsy_cwMode',	'qsyConfig','cwMode');

	wireUpConfigValue('rotor_method',	'rotorConfig','method');
	wireUpConfigValue('rotor_host',		'rotorConfig','host');
	wireUpConfigValue('rotor_port',		'rotorConfig','port');
	wireUpConfigValue('rotor_proto',	'rotorConfig','proto');
	wireUpConfigValue('rotor_target_host',	'rotorConfig','target_host');
	wireUpConfigValue('rotor_target_port',	'rotorConfig','target_port');

	wireUpConfigChecked('enableNeededParks','','enableNeededParks');
	wireUpConfigChecked('enableNeededWAS','','enableNeededWAS');
	wireUpConfigChecked('enableNeededLocations','','enableNeededLocations');
	wireUpConfigChecked('enableNeededN1CC','','enableNeededN1CC');
	wireUpConfigChecked('enableNeededOps','','enableNeededOps');
	wireUpConfigChecked('enableMyAwards','','enableMyAwards');

	wireUpConfigChecked('enableSpotTimeAbbrv','','enableSpotTimeAbbrv');
	wireUpConfigChecked('enableFilterLabelTimeAbbrv','','enableFilterLabelTimeAbbrv');
	wireUpConfigChecked('enableSpotFilters','','enableSpotFilters');
	wireUpConfigChecked('enableUTCClock','','enableUTCClock');
	wireUpConfigChecked('enableHideSpotterCall','','enableHideSpotterCall');
	wireUpConfigChecked('enableHideSpotterComment','','enableHideSpotterComment');
	wireUpConfigChecked('enableSpaceWX','','enableSpaceWX');
	wireUpConfigChecked('enableWidget_RigRef','','enableWidget_RigRef');
	wireUpConfigChecked('enableOpProfileInfo','','enableOpProfileInfo');
	wireUpConfigChecked('enableBandEdgeWarnings','','enableBandEdgeWarnings');
	wireUpConfigChecked('enableLogDisplay','','enableLogDisplay');

	wireUpConfigChecked('enableIconQRZ','','enableIconQRZ');
	wireUpConfigChecked('enableIconRBN','','enableIconRBN');
	wireUpConfigChecked('enableIconPSKReporter','','enableIconPSKReporter');

	wireUpConfigValue('log_additionalADIFFields','loggingConfig','additionalADIFFields');

	document.getElementById('qsy_details').style.display = OPTIONS.enableQsy ? '' : 'none';
	document.getElementById('log_details').style.display = OPTIONS.enableLogging ? '' : 'none';
	document.getElementById('rotor_details').style.display = OPTIONS.enableRotor ? '' : 'none';

	var isHamAppsProxy = OPTIONS.loggingConfig.method == 'qrz' ? false : true;
	document.getElementById('logTargetApi').style.display = isHamAppsProxy ? 'none' : ''    ;
	document.getElementById('logTargetApp').style.display = isHamAppsProxy ? ''     : 'none';
    }
});


