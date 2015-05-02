var request = require('request');

var _oldGetRequest = request.get;
var lastRequest = 0;

request.get = function() {
	var diff = new Date() - lastRequest;
	var delay = diff > 1000 ? 0 : (1000 - diff);
	setTimeout(function() {
		_oldGetRequest.apply(this, arguments);
	}, delay);
	lastRequest = new Date();
}
