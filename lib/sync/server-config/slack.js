var merge = require('merge');
var request = require('request');

var ServerConfig = require('./server-config');

var SLACK_TOKEN = require('./_private').SLACK_TOKEN;
var SLACK_CHANNEL = 'C04EUJWTL';  // #lm-portal: C04GS1ZLF

var slackConf = new ServerConfig({
  urlBase: 'https://slack.com/api/',
  getParam: function(type) {
    var def = { token: SLACK_TOKEN };
    if (type == 'fetch')
      merge(def, {
        channel: SLACK_CHANNEL,
        count:   1000
      });
    else if (type == 'send')
      merge(def, {

      });
    return def;
  },
  fetch: function(handler) {
    var that = this;
    var param = this.getParam('fetch');
    if(this.lastTimestamp)
      param.oldest = this.lastTimestamp;
    var url = this.getURL('channels.history', param);

    return request.get(url, function(err, req, body) {
      //data is DESC
      if(!err){
        var resp = JSON.parse(body);
        if(resp.messages.length){
          var newestObj = resp.messages[0];
          that.lastTimestamp = newestObj.ts;
          that.lastId = '';
        }
        handler.call(that, resp);
      } else {
        throw new Error('Fetch from Slack failed: ' + err);
      }
    });
  },
  decode: function(resp) {
    var list = [];
    resp.messages.forEach(function(v) {
      // prevent circular dependency
      var Post = require('../post');
      // exclude subtype
      if(v.subtype) return;
      list.push(new Post(v));
    });
    return list;
    // return resp.messages.map(function(v){return v.text})
  },
  send: function(doc) {

  }
});

module.exports = slackConf;
