var output = null;
var ssdpData = "";
var sid;
var rokurl = null;
var urlaAge;
var maindiv;
var wheel;
var byteArray;
var blob;
var historyurl;
var connect;
var rokuNotice;
var ROKU_AGENT_ID=63126; //'dev';//
var isAgentPresent=false;

/*
 * This function will be called when this js is loaded.
 */
window.addEventListener("load", function() {

	var remoteButtons = ['Home', 'Rev', 'Fwd', 'Play', 'Select', 'Left', 'Right', 'Down', 'Up', 'Back', 'InstantReplay', 'Info'/*,'Backspace','Search','Enter' Major TODO*/];
	for (var amuk = 0; amuk < remoteButtons.length; amuk++) {//console.log(remoteButtons[amuk]);
		tmp = document.getElementById(remoteButtons[amuk]);
		tmp.onclick = handleKeypress;

	}
	rokuNotice = document.getElementById('rokuAppNotice');
	var target = document.getElementById('spinnn');
	var spinner = new Spinner(opts).spin(target);

	//console.log("SSDP multicast app starts");
	connect = document.getElementById("start");
	connect.onclick = ssdpCheckAndRun;

	/*var credits = document.getElementById("credits");
	credits.onclick = launchCredits;*/

	//	var back = document.getElementById("Back");
	var playit = document.getElementById("sendToRoku");
	playit.onclick = playOnRoku;

	output = document.getElementById("output");
	maindiv = document.getElementById("main");
	wheel = document.getElementById("spinnn");

	//For first load.. just start finding a roku..
	ssdpCheckAndRun();

});
						//	img.class = "nicecolor";
//Prepate the remote's chanel pad part, this is specic to connected roku. 
//Hence need to be generated dyanimcailly.
populateChannelPad = function() {

	var channelQuery = new XMLHttpRequest();
	channelQuery.open("GET", rokurl + 'query/apps', true);
	channelQuery.onreadystatechange = function() {
		if (channelQuery.readyState == 4) {
			channelListXml = channelQuery.responseXML;

			var tukde = channelListXml.getElementsByTagName('app');
			var xmlhttp2 = [];

			for (var looper = 0; looper < tukde.length; looper++) {

				//-----------START IN LOOP FOR
				if(tukde[looper].id==ROKU_AGENT_ID)
				{
					isAgentPresent = true;
					
					console.log('Agent '+ROKU_AGENT_ID + 'found ! , let the party begin');
					rokuNotice.style.display='none';
				}
				xmlhttp2[looper] = new XMLHttpRequest();
				xmlhttp2[looper].open("GET", rokurl + 'query/icon/' + tukde[looper].id, true);
				xmlhttp2[looper].responseType = 'blob';
				//var channelID = tukde[looper].id;
				xmlhttp2[looper].onreadystatechange = function() {
					if (this.readyState == 4) {

						var blob = new Blob([this.response], {
							type : 'image/jpg'
						});
						var burl = URL.createObjectURL(blob);

						var channelHandle = document.getElementById('channelThing');
						
						/* Construct img tag with channel logo and add action to call channel launch API onClick*/
						var img = document.createElement('img');
						img.src = window.URL.createObjectURL(new Blob([this.response]), {
							type : 'image/jpg'
						});
						img.style.width = 96;
						img.height = 72;

						var urlToCall = this.responseURL.replace('query/icon', 'launch');

						img.addEventListener('click', function() {
							rokuAPICall(urlToCall);
						}, false);
						channelHandle.appendChild(img);

					}
				}
				xmlhttp2[looper].send();
				//-----------END IN LOOP FOR

			}

		}
	}
	channelQuery.send();

};

playOnRoku = function() {
	
	if(isAgentPresent){
	var urlbox = document.getElementById("urlinpu");
	var encoded = encodeURIComponent(urlbox.value);
	//console.log(encoded);
	rokuAPICall(rokurl + 'launch/'+ROKU_AGENT_ID+'?myurl=' + encoded);
	
	//report starts for feature enhancement 
		var report = new XMLHttpRequest();
		report.open('GET','http://stats.copy-paste.net/apps/rup/launchVideo');
		report.send();
	}
	else{
		rokuNotice.style.display='block';
	}

};

handleKeypress = function() {
	rokuAPICall(rokurl + 'keypress/' + this.id);
};

rokuAPICall = function(url) {

	if (rokurl == null) {
		ssdpCheckAndRun();
	}
	//replace this with callbacks;
	if (rokurl == null) {
		//console.log("Network probel")
	} else {
		var x = new XMLHttpRequest();
		x.open('POST', url);
		//console.log('POST URL : '+url);
		x.responseType = 'json';
		x.onreadystatechange = function() {
			//console.log(x.readyState);

		};
		x.send();
		//  //console.log(x.response);

	}

}
/*
 * translate text string to arryed buffer
 */
function t2ab(str /* String */) {
	var buffer = new ArrayBuffer(str.length);
	var view = new DataView(buffer);
	for (var i = 0,
	    l = str.length; i < l; i++) {
		view.setInt8(i, str.charAt(i).charCodeAt());
	}
	return buffer;
}

/*
 * translate arrayed buffer to text string
 */
function ab2t(buffer /* ArrayBuffer */) {
	var arr = new Int8Array(buffer);
	var str = "";
	for (var i = 0,
	    l = arr.length; i < l; i++) {
		str += String.fromCharCode.call(this, arr[i]);
	}
	return str;
}

var killSocketAfterSomeTime = function() {

	chrome.socket.destroy(sid);

	if (rokurl == null) {
		console.log('Need a history lesson');
		//TODO : Error handling and wheel kill.
		chrome.storage.sync.get('history', function(things) {

			console.log(things.history);
			historyurl = things.history.split('$$$')[1];
			console.log(historyurl);
			rokurl = historyurl;

			wheel.style.display = 'none';

			thingsTodoAfterGettingRokuUrl();
		});
	} else {
		console.log('We are good.. no need to check history.');
	}

};

/*
 * This function will be called when upd packet is recieved
 */
var recieveData = function(socket, sid) {
	socket.recvFrom(sid, function(recv) {
		var data = ab2t(recv.data);

		//---Experimental
		var ecpid;

		//----
		console.log(data);
		var parts = data.split("\r\n");

		for (var i = 0; i < parts.length; i++) {
			if (parts[i].split(':')[0].toUpperCase() === 'LOCATION') {
				rokurl = parts[i].substr(parts[i].indexOf(':') + 1, parts[i].length - 1);

			}
			if (parts[i].split(':')[0].toUpperCase() === 'USN') {
				ecpid = parts[i].substr(parts[i].indexOf(':') + 1, parts[i].length - 1);
				ecpid = ecpid.trim();
				ecpid = ecpid.split(':')[3];
				console.log('ecp=>>' + ecpid + '<<');
			}
		}
		if (ecpid != null && rokurl != null) {
			chrome.storage.sync.set({
				'history' : ecpid + "$$$" + rokurl.trim()
			}, function() {
				console.log('Synced with chrome')
			});
			thingsTodoAfterGettingRokuUrl();
		}
		
		//recieveData(socket, sid);

	});
	
	//
};

var thingsTodoAfterGettingRokuUrl = function() {
	xmlhttp = new XMLHttpRequest();
	xmlhttp.open("GET", rokurl, true);
	xmlhttp.onreadystatechange = function() {
		if (xmlhttp.readyState == 4) {
			if (xmlhttp.status == 200) {

				xmlDoc = xmlhttp.responseXML;

				//check that we have found right roku, populate things and stop the fucking wheel.
				maindiv.style.display = 'block';
				wheel.style.display = 'none';

				var friendly = xmlDoc.getElementsByTagName('friendlyName')[0].childNodes[0].nodeValue;
				var modelName = xmlDoc.getElementsByTagName('modelName')[0].childNodes[0].nodeValue;

				var friendly_name = document.getElementById('friendly_name');
				friendly_name.innerHTML = '<h2>Device:' + friendly + '/' + modelName + '</h2>';

				output.style.display = 'block'
				populateChannelPad();
			} else if (XMLHttpRequest.status == 0) {
				console.log('There Was an incident !' + xmlhttp.status);
				rokurl = null;
				connect.disabled = false;
			} else {
				console.log('There Was nonzero incident !' + xmlhttp.status);
			}

		}
	}

	xmlhttp.send();

}
var ssdpCheckAndRun = function() {
	connect.disabled = true;
	if (rokurl == null || ((new Date).getTime() - urlaAge) > 3600000) {
		ssdpStart();
		urlaAge = (new Date).getTime();
	} else {

	}

}


var ssdpStart = function() {

	var MSearchAll = "M-SEARCH * HTTP/1.1\r\n" + "ST: ssdp:all\r\n" + "MAN: \"ssdp:discover\"\r\n" + "HOST: 239.255.255.250:1900\r\n" + "ST: roku:ecp\r\n" + "MX: 10\r\n\r\n";

	var mstring = "M-SEARCH * HTTP/1.1\r\nHost: 239.255.255.250:1900\r\nMan: \"ssdp:discover\"\r\nST: roku:ecp\r\n";
	MSearchAll = mstring;
	// chrome socket
	var socket = chrome.socket;
	// SSDP multicast address
	var SSDPMulticastAddress = "239.255.255.250";
	// SSDP multicast port
	var SSDPMulticastPort = 1900;

	// create udp socket
	socket.create('udp', {}, function(socketInfo) {
		sid = socketInfo.socketId;
		//console.log("socket id: " + sid);
		socket.bind(sid, "0.0.0.0", 0, function(res) {
			if (res !== 0) {
				throw ('cannot bind socket');
				return -1;
			}

			// recieve data
			recieveData(socket, sid);

			// Send SSDP Search x 2
			var buffer = t2ab(MSearchAll);
			for (var i = 0; i < 2; i++) {
				wheel.style.display = 'block';
				socket.sendTo(sid, buffer, SSDPMulticastAddress, SSDPMulticastPort, function(e) {
					if (e.bytesWritten < 0) {
						throw ("an Error occured while sending M-SEARCH : " + e.bytesWritten);
					}
				});
			}

			setTimeout(killSocketAfterSomeTime, 10000);

		});
	});
};


var opts = {
	lines : 15, // The number of lines to draw
	length : 29, // The length of each line
	width : 15, // The line thickness
	radius : 18, // The radius of the inner circle
	corners : 1, // Corner roundness (0..1)
	rotate : 48, // The rotation offset
	direction : 1, // 1: clockwise, -1: counterclockwise
	color : '#FF6600', // #rgb or #rrggbb or array of colors
	speed : 1.5, // Rounds per second
	trail : 79, // Afterglow percentage
	shadow : true, // Whether to render a shadow
	hwaccel : true, // Whether to use hardware acceleration
	className : 'spinner', // The CSS class to assign to the spinner
	zIndex : 2e9, // The z-index (defaults to 2000000000)
	top : '50%', // Top position relative to parent
	left : '50%' // Left position relative to parent
};
