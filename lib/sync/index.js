/**
 * A Slack-LM Bridge.
 * @author Andy Pan
 */

var async = require('async');
var request = require('request');
var PeriodicTask = require('periodic-task');

var Post = require('./post');
var config = require('./server-config/index');

//todo: when not receiving new message for some ticks, go to idle mode
// and reduce freq of acqiry.
// once new message for another thershold, go to active mode.
//change interval by stop and starting again with new interv.
var INTERVAL_NORMAL = 5 * 1000;
var INTERVAL_IDLE = 3 * 60 * 1000;
var idleTicks = 0;
var thershold = 10;

var taskFN = function() {
  console.log('Tick. ' + new Date().toISOString());
  async.parallel([
    function(callback) {
      config.slack.fetch(function(resp) {
        // resp.messages[0].ts
        var list = this.decode(resp);
        
        callback(null, this, list);
      });
    }, function(callback) {
      config.lm.fetch(function(resp) {
        // resp.list.map(function(v){return v.message})
        if (!resp) {
          console.log(' ! Oops! LM connection timeout.');
          callback(null, this);
          return;
        }
        var list = this.decode(resp);
        callback(null, this, list);
      });  
    }
  ], function(err, result) {
    function prepareSync(name, data) {
      if(!data[1]) return;
      var len = data[1].length;
      if(len) {
        console.log(' * ' + name + ': ' + len + ' new message(s).');
        console.log('  lastest posts:');
        console.log('  - ' + data[1].join('\n  - '));
      } else {
        console.log(' * ' + name + ': up to date...');
      }
      // todo: encode post and then send request
    }
    prepareSync('Slack', result[0]);
    prepareSync('LM   ', result[1]);
    console.log();
  })
};

var task = new PeriodicTask(INTERVAL_NORMAL, taskFN);

console.log('Initializing...');
async.parallel([
  function(callback) {
    config.slack.fetch(function(resp) {
      // resp.messages[0].ts
      // /*.map(function(v){return v.ts})*/
        callback(null, this.lastTimestamp);
    });
  }, function(callback) {
    config.lm.fetch(function(resp) {
      if (!resp) {
        throw new Error
      }
      callback(null, this.lastTimestamp);
    });  
  }
], function(err, result) {
  console.log('Initialized.');
  console.log(' * Slack last ts = ' + result[0]);
  console.log(' * LearnMode last ts = ' + result[1]);
  console.log();
  console.log('Now watching with INTERVAL = ' + INTERVAL_NORMAL + '.');
  task.run();
});

module.exports = {
  task: task,
  getInfo: function() {
    // todo
    return {};
  }
};
