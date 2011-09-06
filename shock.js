(function() {
  var handler, osdfServer, server, shockHandler;
  osdfServer = require('./lib/osdfServer.js');
  shockHandler = require('./lib/shockHandlers.js');
  server = new osdfServer.Server();
  handler = new shockHandler.Handler(server);
  server.get('/', function(req, res) {
    return handler.status(req, res);
  });
  server.get('/register', function(req, res) {
    return handler.register('get', req, res);
  });
  server.post('/register', function(req, res) {
    return handler.register('post', req, res);
  });
  server.get('/info/:id', function(req, res) {
    return handler.info(req, res);
  });
  server.get('/put/:id/part/:part', function(req, res) {
    return handler.put(req, res, 'get');
  });
  server.get('/put/:id', function(req, res) {
    return handler.put(req, res, 'get');
  });
  server.post('/put/:id/part/:part', function(req, res) {
    return handler.put(req, res, 'post');
  });
  server.post('/put/partial', function(req, res) {
    return handler.put(req, res, 'post');
  });
  server.post('/put', function(req, res) {
    return handler.put(req, res, 'post');
  });
  server.get('/get/:id', function(req, res) {
    return handler.getComplete(req, res);
  });
  server.get('/get/:id/:index/:start', function(req, res) {
    return handler.getChunk(req, res);
  });
  server.get('/del/:id', function(req, res) {
    return handler.del(req, res);
  });
  server.get('/query', function(req, res) {
    return handler.query(req, res);
  });
  server.start();
}).call(this);
