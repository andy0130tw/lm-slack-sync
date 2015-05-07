var merge = require('merge');
var request = require('request');

var ServerConfig = require('./server-config');
var Post = require('../post');

var LM_MAC = require('./_private').LM_MAC;
var LM_MAC_POOL = require('./_private').LM_MAC_POOL;
var LM_RELATED_ID = require('./_private').LM_RELATED_ID;
var LM_OLDEST_TIMESTAMP = 'T0001F681040000';
var TIMEOUT = 10 * 1000;

//from LMClient Ultimate
function lmStyleWordCounter(text) {
  return text.length + occurrences(text, '\n');
  function occurrences(string, substring) {
    var n = 0;
    var pos = 0;
    var l = substring.length;

    while (true) {
      pos = string.indexOf(substring, pos);
      if (pos > -1) {
        n++;
        pos += l;
      } else {
        break;
      }
    }
    return (n);
  }
}

function getRandomOne(arr) {
  if (!arr) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

var lmConf = new ServerConfig({
  urlBase: 'https://message.learnmode.net:5443/api/',
  getParam: function(type) {
    var def = { device: getRandomOne(LM_MAC_POOL) || LM_MAC };
    if (type == 'fetch') {
      merge(def, {
        related: LM_RELATED_ID,
        after:   LM_OLDEST_TIMESTAMP,
        sort:    'date',
        count:   1000
      });
      if (LM_MAC)
        def.device = LM_MAC;
    }
    return def;
  },
  fetch: function(handler) {
    var self = this;
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
          self.lastTimestamp = newestObj.seq_id;
          self.lastId = newestObj.id;
        }

        handler.call(self, resp);
      } else {
        if (err.message === 'ETIMEDOUT'){
          handler.call(self, null);
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
  send: function(coll) {
    var payloads = [];
    var buffer = null;
    var self = this;

    function prepareBuffer(post, doc) {
      buffer = post;
      buffer.message = '[轉送自Slack] 原始時間：' + doc.getDateString() + '\n' + buffer.message;
    }

    // to be date ASC(?)
    // coll.reverse()
    coll.forEach(function(v) {
      // stack as much message as possible into one block
      var post = v.encodeLMPost();
      if (!buffer) {
        prepareBuffer(post, v);
      } else {
        var newMsg = buffer.message + post.message;
        // note: if the text is too long, then the logic will let it go
        if (lmStyleWordCounter(newMsg) >= 1024) {
          // flush current buffer
          payloads.push(buffer);
          // place new data safely
          prepareBuffer(post, v);
        }
        buffer.message += post.message;
      }
    });
    // flush
    if (buffer) payloads.push(buffer);

    payloads.forEach(function(v) {
      var url = self.getURL('post');
      v.related = LM_RELATED_ID;
      v.device = getRandomOne(LM_MAC_POOL) || LM_MAC;
      request.post(url, { form: v }, function(err, req, body) {
        // console.log(err, body);
      });
    });
  }
});

module.exports = lmConf;
