(function() {
  var Routes, Server, Shock, cluster, routes, server, shock;

  cluster = require('cluster');

  Server = require('./lib/Server');

  Routes = require('./lib/Routes');

  Shock = require('./lib/Shock');

  /*
  processes = 2
  if cluster.isMaster
  	for [1..processes]
  		cluster.fork()
  	
  	cluster.on 'death', (worker)->
  	    console.log "worker #{worker.pid} died"
  else
  */

  server = new Server();

  shock = new Shock(server);

  routes = new Routes(server, shock);

  server.get('/', function(req, res) {
    return routes.index(req, res);
  });

  server.get('/paginate', function(req, res) {
    return routes.browse(req, res);
  });

  server.get('/node/:id', function(req, res) {
    return routes.get(req, res);
  });

  server.put('/node/:id', function(req, res) {
    return routes.put(req, res);
  });

  server.post('/node/:id', function(req, res) {
    return routes.post(req, res);
  });

  server["delete"]('/node/:id', function(req, res) {
    return routes.del(req, res);
  });

  server.get('/indexes', function(req, res) {
    return routes.indexes(req, res);
  });

  server.get('/register', function(req, res) {
    return routes.register(req, res);
  });

  server.post('/register', function(req, res) {
    return routes.register(req, res);
  });

  server.start();

}).call(this);
