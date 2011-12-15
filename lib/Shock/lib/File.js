(function() {
  var File, checksumFile, checksumPath, crypto, emitter, exec, fileType, fs, mkdirp, util, wholeFileRead;

  util = require('util');

  fs = require('fs');

  crypto = require('crypto');

  exec = require('child_process').exec;

  mkdirp = require('mkdirp');

  emitter = require('events').EventEmitter;

  File = (function() {

    function File(server) {
      this.server = server;
      this.checksum_type = server.checksum_type || "md5";
      this.data_root = server.data_root;
    }

    File.prototype.create = function(path, checksum, cb) {
      var _this = this;
      if (typeof cb !== 'function') {
        if (typeof checksum === 'function') {
          cb = checksum;
          checksum = null;
        } else {
          throw new Error("File.create can not be called without a callback");
        }
      }
      if (!(checksum != null)) {
        return checksumFile(path, this.checksum_type, function(err, checksum) {
          if (err != null) return cb(err, null);
          return _this.reserve(checksum, function(reserved) {
            if (!reserved) {
              fs.unlink(path);
              return cb(null, checksum);
            } else {
              return mkdirp("" + _this.data_root + "/" + (checksumPath(checksum)), '0755', function(err) {
                if (err != null) return cb(err, null);
                return exec("mv " + path + " " + _this.data_root + "/" + (checksumPath(checksum)) + "/" + checksum, function(error, stdout, stderr) {
                  if (err != null) return cb(stderr, null);
                  return _this.update(checksum, function(err) {
                    if (err != null) return cb(err, null);
                    return cb(null, checksum);
                  });
                });
              });
            }
          });
        });
      } else {
        return this.reserve(checksum, function(reserved) {
          if (!reserved) {
            fs.unlink(path);
            return cb(null, checksum);
          } else {
            return mkdirp("" + _this.data_root + "/" + (checksumPath(checksum)), '0755', function(err) {
              if (err != null) return cb(err, null);
              return exec("mv " + path + " " + _this.data_root + "/" + (checksumPath(checksum)) + "/" + checksum, function(error, stdout, stderr) {
                if (err != null) return cb(stderr, null);
                return _this.update(checksum, function(err) {
                  if (err != null) return cb(err, null);
                  return cb(null, checksum);
                });
              });
            });
          }
        });
      }
    };

    File.prototype.reserve = function(checksum, cb) {
      var _this = this;
      return this.server.query("insert into files (checksum) values ($1)", [checksum], function(err, results) {
        if (err != null) return cb(false);
        return cb(true);
      });
    };

    File.prototype.update = function(checksum, cb) {
      var path;
      var _this = this;
      path = this.path(checksum);
      return fs.stat(path, function(err, stats) {
        if (err != null) return cb(err);
        return fileType(path, function(err, type) {
          if (err != null) return cb(err);
          return _this.server.query("update files set (checksum_type, file_format, file_type, file_size) = ($2, $3, $4, $5) where checksum = $1", [checksum, _this.checksum_type, null, type, stats.size], function(err, results) {
            if (err != null) return cb(err);
            return cb(null);
          });
        });
      });
    };

    File.prototype.path = function(checksum) {
      return "" + this.data_root + "/" + (checksumPath(checksum)) + "/" + checksum;
    };

    File.prototype.exists = function(checksum) {
      var _this = this;
      return this.server.query("select count(checksum) from files where checksum = $1", [checksum], function(err, results) {
        if (err != null) return cb(err, null);
        if ((results != null) && results.rows.length > 0) return cb(true);
        return cb(false);
      });
    };

    File.prototype["delete"] = function(checksum, cb) {};

    File.prototype.attach = function(checksum, file_name, node_id, cb) {
      var _this = this;
      return this.server.query("select * from files where checksum = $1", [checksum], function(err, results) {
        if (err != null) return cb(err, null);
        if (results.rows[0] == null) return cb(err, null);
        if (results.rows[0].file_size == null) {
          return setTimeout((function() {
            return _this.attach(checksum, file_name, node_id, cb);
          }), 50);
        }
        return _this.server.query("update nodes set (file_name, size, checksum) = ($1, $2, $3) where id = $4", [file_name, results.rows[0].file_size, checksum, node_id], function(err, results) {
          if (err != null) return cb(err, null);
          if (results != null) return cb(null, true);
          return cb(null, false);
        });
      });
    };

    File.prototype.detach = function(checksum, node_id) {
      var _this = this;
      return this.server.query("update nodes set (file_name, size, checksum) = ($1, $2) where id = $3 and checksum = $4", [null, null, null, node_id, checksum], function(err, results) {
        if (err != null) return cb(err, null);
        if (results != null) return cb(null, true);
        return cb(null, false);
      });
    };

    File.prototype.get = function(checksum) {
      var path;
      path = this.path(checksum);
      return new wholeFileRead(path);
    };

    return File;

  })();

  module.exports = File;

  wholeFileRead = function(path) {
    emitter.call(this);
    return fs.createReadStream(path).addListener('data', function(chunk) {
      return this.emit('chunk', chunk);
    }).addListener('end', function() {
      return this.emit('done');
    });
  };

  util.inherits(wholeFileRead, emitter);

  fileType = function(path, cb) {
    var _this = this;
    return exec("file " + path, function(error, stdout, stderr) {
      if (typeof err !== "undefined" && err !== null) return cb(stderr, null);
      return cb(null, stdout.split(": ")[1].replace(/[\s\r\n]+$/, ''));
    });
  };

  checksumPath = function(checksum) {
    return "" + (checksum.substring(0, 2)) + "/" + (checksum.substring(2, 4)) + "/" + (checksum.substring(4, 6));
  };

  checksumFile = function(path, type, cb) {
    var f, sum;
    sum = crypto.createHash(type);
    f = fs.ReadStream(path);
    f.on('data', function(d) {
      return sum.update(d);
    });
    f.on('error', function(err) {
      console.log("checksumFile - error");
      return cb(err, null);
    });
    return f.on('end', function() {
      return cb(null, sum.digest('hex'));
    });
  };

}).call(this);
