var slack = require('../server-config/slack');
var request = require('request');
var Sync = require('sync');

var userList = null;

function loadUserList() {
  request.get(slack.getURL('users.list', slack.getParam()), function(err, req, body) {
    if(err) {
      throw new Error('failed to get user list from Slack: ' + err);
    }
    var newList = {};
    JSON.parse(body).members.forEach(function(v) {
      if(!v.profile || !v.profile.bot_id)
        newList[v.id] = v;
    });
    // do bulk update
    userList = newList;
    // if (callback)
    //   callback.call(this, null, userList);
  });
}

Sync(function() {
  loadUserList.sync(function(callback) {
    callback();
  });
});
// keep user data up to date
setInterval(loadUserList, 30 * 1000);

module.exports = function(callback) {
  if(!userList)
    loadUserList(callback);
  // else if(callback)
  //   callback.call(this, userList);
  return userList;
};
