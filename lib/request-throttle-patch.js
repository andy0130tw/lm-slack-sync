var request = require('request');
var _oldGetRequest = request.get;

request.get = function() {
	console.log('request get called!');
	_oldGetRequest.apply(this, arguments);
}
