# slack-lm-sync
Exprimental server to adapt/sync posts between two different services.

## Structure
  1. Two [`ServerConfig`](lib/sync/server-config/server-config.js) objects are used as interfaces for communicating with the server. They exposes `fetch`, `decode`, and `send`.
  2. [`Post`](lib/sync/post.js) is the class that transform raw posts from server responses. This way, all posts have unified properties and add some flexibility send to any posts to different servers.
  3. Because Slack limits the rate of the requests, we need to patch `request` module to allow throttling. Though monkey-patching could be ugly and it is a bad design pattern, this is the only way I can think of. By the way, I don't know if the implementation is correct. The code is in [request-throttle-patch.js](request-throttle-patch.js).
  4. A hidden file `_private.js` contains some tokens, thus it is not present on GitHub. so you need to configure them yourself before kicking all stuffs off.
