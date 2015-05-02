var slackUserProvider = require('./services/slack-user-list');

var LM_IMAGE_URL_PREFIX = 'https://message.learnmode.net:5443/image/';

/**
 * Post adapter
 * Must implement the following parameters for it to work properly.
 *  - type:      determined original message type
 *  - username:  the poster's name
 *  - message:   plain-text message body
 *  - timestamp: lost time information when syncing (as a latency indicator...?)
 *  - realname:  realname needed when posting to LM
 *  
 * And the following parameters are platform-specific...
 *  they are added only in the following provider.
 *  - avatar:    (lm)    image of the user
 *  - image:     (lm)    image attachment from LM user
 *  
 * @param {Object} doc  message document from message provider
 * @param {String} type unused argument :)
 */
var Post = function(doc, type){
  // determine schema to do convertion
  if(doc.type && doc.ts) {
    // Slack
    var userList = slackUserProvider();
    if (!userList) {
      throw new Error('userList is not ready');
    }
    var slackUser = userList[doc.user];
    if (!slackUser) {
      throw new Error('user id is not found: '+ doc.user);
    }
    this.type = 'slack';
    this.username = slackUser.name;
    // useless
    // this.avatar = slackUser.profile.image_192;
    this.message = doc.text;
    // UNIX sec
    this.timestamp = new Date(doc.ts * 1e3);
    // this.image = doc.attachments;
    if (doc.profile)
      this.realname = slackUser.profile.real_name;
  } else {
    // LM
    this.type = 'lm';
    // assume user data is joined in _user
    var user = doc._user;
    if (!user)
      throw new Error('_user missing for lm posts');

    // may NOT use this when posting slack
    this.username = user.username;
    this.realname = user.name;
    this.avatar = LM_IMAGE_URL_PREFIX + user.image;

    this.image = LM_IMAGE_URL_PREFIX + doc.image;
    this.message = doc.message;
    // ISO8601 format is acceptable
    this.timestamp = new Date(doc.date);
  }
};

/* '[轉信] ' +  */

/**
 * for transferring single message to LM.
 * @return {Object} plain-object
 */
Post.prototype.encodeLMPost = function() {
  var nameFrag = this.realname ? (this.realname + '(' + this.username + ')') : ('@' + this.username);
  var tfStr = nameFrag + '：' + this.message + '\n';
  // todo: check length
  // join multiple posts?
  return {
    message: tfStr,
    category: 'comment',
    application: 'lm-slack-sync',
    subject: '10001'
    // related
  };
};

/**
 * for transferring single message to Slack.
 * @return {Object} plain-object
 */
Post.prototype.encodeSlackPost = function() {
  return {
    // todo
  }
};

/**
 * for exporting out to console only
 * @return {String} plain-text
 */
Post.prototype.toString = function() {
  return '[' + this.type + '] @' + this.username + ': ' + this.message;
};

module.exports = Post;
