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
var INTERVAL_NORMAL = 10 * 1000;
var INTERVAL_IDLE = 15 * 60 * 1000;
var idleTicks = 0;
var idleThershold = 10;

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
    }
    prepareSync('Slack', result[0]);
    prepareSync('LM   ', result[1]);

    if (result[0][1] && result[1][1] 
      && (result[0][1].length + result[1][1].length)) {
      // send post payload
      config.lm.send(result[0][1]);
      config.slack.send(result[1][1]);
      if (idleTicks >= idleThershold) {
        console.log('changed to normal mode');
        task.delay(INTERVAL_NORMAL);
      }
      idleTicks = 0;
    } else {
      idleTicks++;
      console.log('idleTicks has been set to ' + idleTicks + '/' + idleThershold);
      if (idleTicks == idleThershold) {
        console.log('changed to idle mode');
        task.delay(INTERVAL_IDLE);
      }
    }

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
