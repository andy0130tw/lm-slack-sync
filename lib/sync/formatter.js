/**
 * Slack Message Formatter
 * Specs: https://api.slack.com/docs/formatting
 */
var nameRegex = /<(.)([A-Z0-9]{9})(?:\|(.+?))?>/g;
var linkRegex = /<(.+?)(?:\|(.+))?>/g;
var userList = require('./services/slack-user-list');

function getUserReplaceString(userId) {
  var users = userList();
  if (!users) return '@' + userId;
  var user = users[userId];
  if (!user) return '@' + userId;
  var name = user.name;
  var realName = user.real_name;
  if (!realName) return '@' + name;
  return '@[' + name + ' (' + realName + ')]';
};

module.exports = {
  formatSlackMessage: function(str) {
    return str.replace(nameRegex, function(match, p1, p2, p3, ofs, str) {
      // p1: symbol, either @ or #
      // p2: main body to be parsed
      // p3: alternative text
      if (p1 == '#') {
      	return '#' + (p3 || ('[channel:' + p2 + ']'));
      } else if (p1 == '@') {
      	return rtn = getUserReplaceString(p2);
      } else {
      	return p2 + '|' + p3;
      }
    }).replace(linkRegex, '$1');
  }
};
