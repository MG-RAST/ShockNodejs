(function() {
  var Server, express, fs, pg;

  express = require('express');

  fs = require('fs');

  pg = require('pg')["native"];

  pg.defaults.poolSize = 50;

  Server = (function() {

    function Server() {
      var app;
      try {
        this.conf = JSON.parse(fs.readFileSync("conf/server.conf", 'utf8'));
      } catch (err) {
        console.log(err);
      }
      this.url = this.conf.url;
      this.name = this.conf.name;
      this.port = this.conf.port;
      this.data_root = this.conf.data_root;
      this.dbconnect = "pg://" + this.conf.dbuser + (this.conf.dbpasswd != null ? ":" + this.conf.dbpasswd : "") + "@" + this.conf.dbhost + "/" + this.conf.dbname;
      this.upload_dir = this.conf.upload_dir;
      this.checksum_type = this.conf.checksum_type || 'md5';
      express.logger.token('custom', function(req, res) {
        var date;
        date = new Date;
        return "" + (req.socket && (req.socket.remoteAddress || (req.socket.socket && req.socket.socket.remoteAddress))) + " - [" + (date.toDateString()) + " " + (date.toLocaleTimeString()) + "] \"" + req.method + " " + req.url + "\" " + (res.__statusCode || res.statusCode) + " -";
      });
      app = express.createServer();
      app.configure(function() {
        app.use(express.logger({
          format: ':custom :response-time ms'
        }));
        app.use(express.static("static"));
        app.use(app.router);
        return app.set('view engine', 'jade');
      });
      this.app = app;
    }

    Server.prototype.start = function() {
      console.log("Starting " + this.name + " (port :" + this.port + ", " + this.data_root + ")");
      return this.app.listen(this.port);
    };

    Server.prototype.head = function(url, callback) {
      try {
        return this.app.head(url, callback);
      } catch (err) {
        return console.log(err);
      }
    };

    Server.prototype.get = function(url, callback) {
      try {
        return this.app.get(url, callback);
      } catch (err) {
        return console.log(err);
      }
    };

    Server.prototype.put = function(url, callback) {
      try {
        return this.app.put(url, callback);
      } catch (err) {
        return console.log(err);
      }
    };

    Server.prototype.post = function(url, callback) {
      try {
        return this.app.post(url, callback);
      } catch (err) {
        return console.log(err);
      }
    };

    Server.prototype["delete"] = function(url, callback) {
      try {
        return this.app["delete"](url, callback);
      } catch (err) {
        return console.log(err);
      }
    };

    Server.prototype.query = function(query_statement, query_array, callback) {
      return pg.connect(this.dbconnect, function(err, client) {
        var q;
        if (query_array.length === 0) {
          return q = client.query(query_statement, function(err, results) {
            return q.on('end', function() {
              if (err != null) return callback(err, null);
              if (typeof callback === 'function') return callback(null, results);
            });
          });
        } else {
          return q = client.query(query_statement, query_array, function(err, results) {
            return q.on('end', function() {
              if (err != null) return callback(err, null);
              if (typeof callback === 'function') return callback(null, results);
            });
          });
        }
      });
    };

    return Server;

  })();

  module.exports = Server;

}).call(this);
