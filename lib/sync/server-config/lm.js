var merge = require('merge');
var request = require('request');

var ServerConfig = require('./server-config');
var Post = require('../post');

var LM_MAC = require('./_private').LM_MAC;
var LM_RELATED_ID = require('./_private').LM_RELATED_ID;
var LM_OLDEST_TIMESTAMP = 'T0001F681040000';
var TIMEOUT = 10 * 1000;

var lmConf = new ServerConfig({
  urlBase: 'https://message.learnmode.net:5443/api/',
  getParam: function(type) {
    var def = { device: LM_MAC };
    if (type == 'fetch')
      merge(def, {
        related: LM_RELATED_ID,
        after:   LM_OLDEST_TIMESTAMP,
        sort:    'date',
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
      param.after = this.lastTimestamp;
    var url = this.getURL('list', param);

    return request.get(url, {timeout: TIMEOUT}, function(err, req, body) {
      // assert not 'request failed, sorry'
      if(!err && body[0] == '{'){
        var resp = JSON.parse(body);
        var list = resp.list;
        //data is ASC
        if(resp.list.length){
          var newestObj = resp.list.slice(-1)[0];
          that.lastTimestamp = newestObj.seq_id;
          that.lastId = newestObj.id;
        }

        handler.call(that, resp);
      } else {
        if (err.message === 'ETIMEDOUT'){
          handler.call(that, null);
          return;
        }
        throw new Error('Fetch from LM failed: ' + (err || body));
      }
    });
  },
  decode: function(resp) {
    var list = [];
    var users = resp.users;

    resp.list.forEach(function(v) {
      // prevent circular dependency
      var Post = require('../post');
      // important! the code must filter out transferred messages
      //  otherwise the posts would be transferred back and forth
      if (v.application.indexOf('sync') >= 0) return;       
      v._user = users[v.from];
      if (!v._user) {
        return;
        // throw new Error('cannot match user from records: ' + v.from);
      }
      list.push(new Post(v));
    });
    return list;
  },
  send: function(doc) {

  }
});

module.exports = lmConf;
