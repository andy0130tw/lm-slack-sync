var request = require('request');

var _oldGetRequest = request.get;
var _oldPostRequest = request.post;
var lastRequest = 0;
var pendingRequestCount = 0;

function wrapThrottle(oldFunc) {
  return function() {
    pendingRequestCount++;
    var self = this, args = arguments;
    var diff = new Date() - lastRequest;
    var scheduledTime = 1000 * pendingRequestCount;
    var delay = diff > scheduledTime ? 0 : (scheduledTime - diff);
    setTimeout(function() {
      oldFunc.apply(self, args);
      pendingRequestCount--;
    }, delay);
    lastRequest = new Date();
  };
}

request.get = wrapThrottle(_oldGetRequest);
request.post = wrapThrottle(_oldPostRequest);
