var querystring = require('querystring');
var merge = require('merge');

var ServerConfig = function(conf){
  this.lastTimestamp = 0;
  // this.lastId = null;
  merge(this, conf);
};

ServerConfig.prototype.getURL = function(path, param) {
  if(!this.urlBase) return null;
  return this.urlBase + path + '?' + querystring.encode(param);
};

module.exports = ServerConfig;
