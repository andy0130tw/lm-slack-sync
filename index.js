var express = require('express');

// monkey-patching request to allow throttling
// must be loaded before the first request
require('./lib/sync/request-throttle-patch');

var ServiceSync = require('./lib/sync/index');

var app = express();

app.set('port', (process.env.PORT || 8080));

// app.use(bodyParser.urlencoded({ extended: true }));

app.listen(app.get('port'), function () {
  console.log('app starting at port '+ app.get('port'));

  var appName = process.env.APP_NAME;
  if(appName)
    setInterval(function () {
      console.log('ping every 20 minutes');
      request.get('http://' + appName + '.herokuapp.com/ping');
    }, 20 * 60 * 1000);

});

app.get('/', function(req, resp) {
  resp.write('welcome to the brand new LM Utility!');
});

app.get('/ping', function(req, resp) {
  resp.write('pong');
});

app.get('/sync/status', function(req, resp) {
  resp.write('Synced ' + json.stringify(ServiceSync.getInfo()) + ' posts');
});
