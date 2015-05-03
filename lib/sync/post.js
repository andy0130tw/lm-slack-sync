var slackUserProvider = require('./services/slack-user-list');

var LM_IMAGE_URL_PREFIX = 'https://message.learnmode.net:5443/image/';

function getLMImage(hash) {
  return LM_IMAGE_URL_PREFIX + hash + '?size=X';
}

var LM_SINGLE_MESSAGE_LENGTH_LIMIT = 512;

/**
 * Post adapter
 * Must implement the following parameters for it to work properly.
 *  - type:      determined original message type
 *  - username:  the poster's name
 *  - message:   plain-text message body
 *  - realname:  realname needed when posting to LM
 *  - image:     image attachment from LM user
 *  - timestamp: UTC milliseconds after 1970.
 *               lost time information when syncing (as a latency indicator...?)
 *  
 * And the following parameters are platform-specific...
 *  they are added only in the following provider.
 *  - avatar:    (lm)    image of the user
 *  - file:      (slack) file id used to point to specific file in Slack
 *  
 * @param {Object} doc  message document from message provider
 * @param {String} type unused argument :)
 */
var Post = function(doc, type){
  // determine schema to do convertion
  if(doc.type && doc.ts) {
    // Slack
    this.type = 'slack';
    
    var userList = slackUserProvider();
    if (!userList) {
      throw new Error('userList is not ready');
    }
    var slackUser = userList[doc.user];
    if (!slackUser) {
      throw new Error('user id is not found: '+ doc.user);
    }
   
    this.username = slackUser.name;
    // useless
    // this.avatar = slackUser.profile.image_192;
    
    // message become unreliable when subtype is given
    if (doc.subtype == 'file_share') {
      this.message = '[圖片]';
      // the file tag will be added when being encoded in LM format
      //  so do not worry here
      // also strip default, useless title
      if (doc.file.title && doc.file.title.match(/Slack for .+? Upload/)) {
        this.message = this.message + ' ' + doc.file.title;
      }
      if (doc.file.initial_comment) {
        this.message = this.message + '\n' + doc.file.initial_comment.comment;
      }
    } else if (doc.subtype =='file_comment') {
      this.message = '[圖片回覆]' + '\n' + doc.comment.comment;
    } else {
      this.message = doc.text;
    }

    // UNIX sec
    this.timestamp = doc.ts * 1e3;
    
    if (slackUser.profile)
      this.realname = slackUser.profile.real_name;

    // handle attachments
    if (doc.attachments) {
      var att = doc.attachments[0];
      if (att.image_url)
        this.image = att.image_url;
    }

    var subtype = doc.subtype;
    var isFileImage = doc.file && doc.file.mimetype.indexOf('image/') == 0;
    // handle subtype and files, files override the image of attachments
    if (subtype == 'file_share' || subtype == 'file_comment') {
      if (isFileImage) {
        this.file = doc.file.id;
        // only original file share thread should have image 
        if (subtype == 'file_share')
          this.image = doc.file.url;
        // todo
      }
    }

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
    this.avatar = getLMImage(user.image);

    if (doc.image)
      this.image = getLMImage(doc.image);
    
    this.message = doc.message;
    // ISO8601 format is acceptable
    this.timestamp = new Date(doc.date) - 0;
  }
};

/**
 * for transferring single message to LM.
 * @return {Object} plain-object
 */
Post.prototype.encodeLMPost = function() {
  var tfStr = this.getNameFrag() + ': ' + this.message + '\n';
  
  if (this.file) tfStr += 'File ID: #' + this.file + '\n';
  if (this.image) tfStr += this.image + '\n';
  
  // trim tfStr and add ellipses
  if (tfStr.length > LM_SINGLE_MESSAGE_LENGTH_LIMIT)
    tfStr = tfStr.slice(0, LM_SINGLE_MESSAGE_LENGTH_LIMIT - 1) + '…';

  // strip out word and put another -- prevent spoofing
  var grave = '■';
  tfStr = tfStr.split(grave).join('　') + ' ' + grave;

  return {
    message: tfStr,
    category: 'comment',
    application: 'lm-slack-sync',
    subject: '10001'
  };
};

/**
 * for transferring single message to Slack.
 * @return {Object} plain-object
 */
Post.prototype.encodeSlackPost = function() {
  var rtn = {
    text: this.message,
    username: this.getNameFrag() + ' @LM',
    parse: 'full', 
    icon_url: this.avatar
  };
  if (this.image) {
    // Slack can't handle this? Sorry JSON please.
    rtn.attachments = JSON.stringify([{
      title: 'Image from LM',
      fallback: 'Image from LM',
      title_link: this.image,
      image_url: this.image,
      // color: 'good'
    }]);
    // rtn.text += '\n' + this.image;
  }
  return rtn;
};

/**
 * for exporting out to console only
 * @return {String} plain-text
 */
Post.prototype.toString = function() {
  return '[' + this.type + '] @' + this.username + ': ' + this.message;
};

/**
 * get unified Date string for displaying
 * cut from LM Utlimate 
 * @return {String} Human-readable date string
 */
Post.prototype.getDateString = function() {
  function numFill(numarr, space) {
    for (var i = 0; i < numarr.length; ++i) {
        numarr[i] = String(numarr[i]);
        while (numarr[i].length < space) {
            numarr[i] = '0' + numarr[i];
        }
    }
    return numarr;
  }

  var ts = this.timestamp;
  // consider time offset +08:00
  var d = new Date(ts + 8 * 3600 * 1e3);
  if (!ts || !d) return '';

  // use all utc time
  var yd = numFill([d.getUTCFullYear()], 4);
  var sd = numFill([d.getUTCMonth() + 1, d.getUTCDate()], 2).join("-");
  var td = numFill([d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()], 2).join(":");

  return yd + '-' + sd + ' ' + td; 
};

Post.prototype.getNameFrag = function() {
  if (this.realname)
    return  this.realname + ' (' + this.username + ')';
  return '@' + this.username;
};

module.exports = Post;
