(function() {
  var express, fs, logFormater, pg;
  express = require('express');
  pg = require('pg');
  fs = require('fs');
  exports.Server = (function() {
    function Server() {
      var app, ver;
      try {
        this.conf = JSON.parse(fs.readFileSync("conf/server.conf", 'utf8'));
      } catch (err) {
        console.log(err);
      }
      ver = this.conf.version;
      this.name = this.conf.name;
      this.verbose = this.conf.verbose;
      this.port = this.conf.port;
      this.shock_host = this.conf[ver].shock_host;
      this.shock_port = this.conf[ver].shock_port;
      this.dbconnect = this.conf[ver].dbpasswd != null ? "pg://" + this.conf[ver].dbuser + ":" + this.conf[ver].dbpasswd + "@" + this.conf[ver].dbhost + "/" + this.conf[ver].dbname : "pg://" + this.conf[ver].dbuser + "@" + this.conf[ver].dbhost + "/" + this.conf[ver].dbname;
      this.data_root = this.conf[ver].data_root;
      this.uploads_dir = this.conf[ver].uploads;
      this.checksum_files = true;
      this.indexes = {
        'record': 'record.index',
        'megabyte': 'MB.index',
        'megabase': 'Mbp.index'
      };
      app = express.createServer();
      app.configure(function() {
        app.use(express.logger({
          format: logFormater
        }));
        app.use(express.static("static"));
        app.use(app.router);
        return app.set('view engine', 'jade');
      });
      this.app = app;
    }
    Server.prototype.start = function() {
      console.log("Starting " + this.name + " server (port :" + this.port + ", " + this.dbconnect + ", " + this.data_root + ")");
      return this.app.listen(this.port);
    };
    Server.prototype.get = function(url, callback) {
      try {
        return this.app.get(url, callback);
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
    Server.prototype.query = function(query_statement, query_array, callback) {
      return pg.connect(this.dbconnect, function(err, client) {
        var q;
        if (err) {
          return console.log(err);
        }
        return q = client.query(query_statement, query_array, function(err, results) {
          return q.on('end', function() {
            if (err) {
              return console.log(err);
            }
            if (typeof callback === 'function') {
              return callback(results);
            }
          });
        });
      });
    };
    return Server;
  })();
  logFormater = function(req, res) {
    var date;
    date = new Date;
    return "" + (req.socket && (req.socket.remoteAddress || (req.socket.socket && req.socket.socket.remoteAddress))) + " - [" + (date.toDateString()) + " " + (date.toLocaleTimeString()) + "] \"" + req.method + " " + req.url + "\" " + (res.__statusCode || res.statusCode) + " - " + res.responseTime + " ms";
  };
}).call(this);
