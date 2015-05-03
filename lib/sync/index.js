/**
 * A Slack-LM Bridge.
 * @author Andy Pan
 */

var async = require('async');
var request = require('request');
var PeriodicTask = require('periodic-task');

var Post = require('./post');
var config = require('./server-config/index');

// when not receiving new message for some ticks, go to idle mode
//  to reduce freq of acqiry.
//  once new message for another thershold, go to active mode.
// change interval by modifying task,
//  it will take effect after at least an original interval.
var INTERVAL_NORMAL = 30 * 1000;
var INTERVAL_IDLE = 10 * 60 * 1000;
var idleTicks = 0;
var idleThershold = 40;

var lastSyncTime = 0;
var lastSetInterval = INTERVAL_NORMAL;
var transferredCount = [0, 0];

var startTime = new Date();

var taskFN = function() {
  lastSyncTime = new Date().toISOString();
  console.log('Tick. ' + lastSyncTime);
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

    var count = [0, 0];
    if (result[0][1] && result[1][1] 
      && ((count[0] = result[0][1].length) + (count[1] = result[1][1].length))
      ) {
      transferredCount[0] += count[0];
      transferredCount[1] += count[1];
      // send post payload
      config.lm.send(result[0][1]);
      config.slack.send(result[1][1]);
      if (idleTicks >= idleThershold) {
        console.log('changed to normal mode');
        task.delay(INTERVAL_NORMAL);
        lastSetInterval = INTERVAL_NORMAL;
      }
      idleTicks = 0;
    } else {
      idleTicks++;
      console.log('idleTicks has been set to ' + idleTicks + '/' + idleThershold);
      if (idleTicks == idleThershold) {
        console.log('changed to idle mode');
        task.delay(INTERVAL_IDLE);
        lastSetInterval = INTERVAL_IDLE;
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
        // if there is no error, the received data next time will flood
        throw new Error('LM init failed!');
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
  },
  handlers: {
    status: function(req, resp) {
      resp.write('<h1>Uptime: ' + (new Date() - startTime) + 'ms</h1>');
      resp.write('<li>start from   <code>' +  startTime.toISOString() + '</code></li>');
      resp.write('<li>current time <code>' + new Date().toISOString() + '</code></li>');

      resp.write('<h1>Status</h1><ul>');
      resp.write('<li>Last Sync = ' + lastSyncTime + '</li>');
      resp.write('<li>Current interval = ' + lastSetInterval + '</li>');
      resp.write('<li>Idle Tick = ' + idleTicks + '/' + idleThershold + '</li>');
      resp.write('<li>Post transferred = ' + transferredCount[0] + ' to LM + ' + transferredCount[1] + ' to Slack.</li>');
      resp.write('</ul>');
      resp.end();
    }
  }
};
