(function() {
  var Routes, clientRes, errorRes, exec, formidable, fs, http, isBrowser, path, recouchdb, sys, uncouchdb, util;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  formidable = require('formidable');

  sys = require('sys');

  fs = require('fs');

  path = require('path');

  http = require('http');

  util = require('util');

  exec = require('child_process').exec;

  Routes = (function() {

    function Routes(server, shock) {
      this.query = __bind(this.query, this);
      this.register = __bind(this.register, this);
      this.update = __bind(this.update, this);
      this.modify = __bind(this.modify, this);      this.server = server;
      this.shock = shock;
    }

    Routes.prototype.index = function(req, res) {
      var columns;
      columns = ['id', 'file_name', 'checksum', 'size', 'attributes', 'acls'];
      if (isBrowser(req)) {
        return res.render('index', {
          locals: {
            pageTitle: "Shock - main",
            columns: columns
          }
        });
      }
    };

    Routes.prototype.browse = function(req, res) {
      var limit, offset, sEcho;
      var _this = this;
      sEcho = req.query.sEcho || 0;
      limit = req.query.iDisplayLength || 10;
      offset = req.query.iDisplayStart || 0;
      return this.shock.nodes.query({}, limit, offset, function(err, nodes) {
        var row, rows, _i, _len;
        if (err != null) return errorRes(res, req, err, "db connection issue");
        rows = [];
        for (_i = 0, _len = nodes.length; _i < _len; _i++) {
          row = nodes[_i];
          rows.push([row.id, row.file_name, row.checksum, row.size, JSON.stringify(row.attributes), JSON.stringify(row.acl)]);
        }
        return _this.shock.nodes.count(function(err, count) {
          if (err != null) return errorRes(res, req, err, "db connection issue");
          return clientRes(res, {
            "sEcho": sEcho,
            "iTotalRecords": count,
            "iTotalDisplayRecords": count,
            aaData: rows
          });
        });
      });
    };

    Routes.prototype.get = function(req, res) {
      if (req.query.list != null) {
        if (req.query.index != null) {
          console.log("route - index parts list");
          return this.single(req, res);
        } else if (req.query.indexes != null) {
          console.log("route - available index list");
          return this.single(req, res);
        } else {
          return this.single(req, res);
        }
      } else if (req.query.download != null) {
        if ((req.query.index != null) && (req.query.part != null)) {
          console.log("route - download index part " + req.query.part);
          return this.single(req, res);
        } else if (req.query.part != null) {
          console.log("route - download default index part " + req.query.part);
          return this.single(req, res);
        } else {
          console.log("route - download full file");
          return this.complete(req, res);
        }
      } else {
        return this.single(req, res);
      }
    };

    Routes.prototype.put = function(req, res) {
      var k, qlen, _i, _len, _ref;
      qlen = 0;
      _ref = req.query;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        k = _ref[_i];
        qlen++;
      }
      if (qlen === 0) return this.update(req, res);
      return this.get(req, res);
    };

    Routes.prototype.single = function(req, res) {
      var id;
      var _this = this;
      id = req.params.id;
      return this.shock.nodes.get(id, function(err, node) {
        if (err != null) return errorRes(res, req, err, err);
        if (isBrowser(req)) {
          res.render('object', {
            locals: {
              pageTitle: "Shock - main",
              id: id,
              object: JSON.stringify(node, null, 4)
            }
          });
        }
        if (!isBrowser(req)) return clientRes(res, node);
      });
    };

    Routes.prototype.del = function(req, res) {
      var id;
      id = req.params.id;
      return this.shock.nodes["delete"](id, function(err) {
        if (err != null) return errorRes(res, req, err, "db connection issue");
        return clientRes(res, {
          "status": "success"
        });
      });
    };

    Routes.prototype.modify = function(req, res) {
      if (isBrowser(req)) {
        return res.render('index', {
          locals: {
            pageTitle: "Shock - main"
          }
        });
      }
      if (!isBrowser(req)) return clientRes(res, {});
    };

    Routes.prototype.complete = function(req, res) {
      var id;
      var _this = this;
      id = req.params.id;
      return this.shock.nodes.checksum(id, function(err, checksum) {
        var rs;
        if (err != null) return errorRes(res, req, err, "db connection issue");
        if (checksum != null) {
          res.writeHead(200, {
            'content-type': 'application/octet-stream',
            'content-disposition': ":attachment;filename=" + id
          });
          rs = _this.shock.file.get(checksum);
          rs.addListener('chunk', function(chunk) {
            return res.write(chunk);
          });
          return rs.addListener('done', function() {
            return res.end();
          });
        } else {
          return errorRes(res, req, err, "id " + id + " has no associated file");
        }
      });
    };

    Routes.prototype.chunk = function(req, res) {
      if (isBrowser(req)) {
        return res.render('index', {
          locals: {
            pageTitle: "Shock - main"
          }
        });
      }
      if (!isBrowser(req)) return clientRes(res, {});
    };

    Routes.prototype.update = function(req, res) {
      var fields, files, form, id;
      var _this = this;
      id = req.params.id;
      form = new formidable.IncomingForm();
      form.uploadDir = this.server.upload_dir;
      fields = {};
      files = {};
      form.on("aborted", function() {
        return console.log("Connection aborted by user");
      });
      form.on("error", function(err) {
        return errorRes(res, req, err, "error: invalid multipart/form data");
      });
      form.on("field", function(field, value) {
        return fields[field] = value;
      });
      form.on("file", function(field, file) {
        return files[field] = file;
      });
      form.on("end", function() {
        var attrFile, attributes;
        attributes = {};
        if (files['attributes'] != null) {
          attrFile = '';
          try {
            attrFile = fs.readFileSync(files['attributes'].path, 'utf8');
          } catch (err) {
            return errorRes(res, req, err, "error: attributes invalid json file");
          }
          try {
            attributes = JSON.parse(attrFile);
          } catch (err) {
            console.log("-------> file start - " + files['attributes'].path);
            console.log(attrFile);
            console.log("-------> file end - " + files['attributes'].path);
            return errorRes(res, req, err, "error: attributes invalid json file");
          }
          fs.unlink(files['attributes'].path);
        }
        return _this.shock.nodes.update(id, attributes, function(err, updated) {
          if (err != null) return errorRes(res, req, err, err);
          if (files['file'] == null) return res.redirect("/node/" + id);
          return _this.shock.file.create(files['file'].path, files['file'].md5, function(err, checksum) {
            if ((err != null) || !(checksum != null)) {
              return errorRes(res, req, err, "internal error");
            }
            return _this.shock.file.attach(checksum, files['file'].name, id, function(err, attached) {
              if (err != null) return errorRes(res, req, err, "internal error");
              return res.redirect("/node/" + id);
            });
          });
        });
      });
      return form.parse(req);
    };

    Routes.prototype.register = function(req, res) {
      var fields, files, form;
      var _this = this;
      if (req.method === "GET") {
        return res.render('register', {
          locals: {
            pageTitle: "Shock - Register"
          }
        });
      } else {
        form = new formidable.IncomingForm();
        form.uploadDir = this.server.upload_dir;
        fields = {};
        files = {};
        form.on("aborted", function() {
          return console.log("Connection aborted by user");
        });
        form.on("error", function(err) {
          return errorRes(res, req, err, "error: invalid multipart/form data");
        });
        form.on("field", function(field, value) {
          return fields[field] = value;
        });
        form.on("file", function(field, file) {
          return files[field] = file;
        });
        form.on("end", function() {
          var attrFile, attributes;
          attributes = {};
          if (files['attributes'] != null) {
            attrFile = '';
            try {
              attrFile = fs.readFileSync(files['attributes'].path, 'utf8');
            } catch (err) {
              return errorRes(res, req, err, "error: attributes invalid json file");
            }
            try {
              attributes = JSON.parse(attrFile);
            } catch (err) {
              console.log("-------> file start - " + files['attributes'].path);
              console.log(attrFile);
              console.log("-------> file end - " + files['attributes'].path);
              return errorRes(res, req, err, "error: attributes invalid json file");
            }
            fs.unlink(files['attributes'].path);
          }
          return _this.shock.nodes.create(attributes, function(err, node) {
            if (err != null) return errorRes(res, req, err, "db connection issue");
            if (files['file'] == null) return res.redirect("/node/" + node.id);
            return _this.shock.file.create(files['file'].path, files['file'].md5, function(err, checksum) {
              if ((err != null) || !(checksum != null)) {
                return errorRes(res, req, err, "internal error");
              }
              return _this.shock.file.attach(checksum, files['file'].name, node.id, function(err, attached) {
                if (err != null) return errorRes(res, req, err, "internal error");
                return res.redirect("/node/" + node.id);
              });
            });
          });
        });
        return form.parse(req);
      }
    };

    Routes.prototype.query = function(req, res) {
      if (isBrowser(req)) {
        return res.render('index', {
          locals: {
            pageTitle: "Shock - main"
          }
        });
      }
      if (!isBrowser(req)) return clientRes(res, {});
    };

    return Routes;

  })();

  module.exports = Routes;

  isBrowser = function(req) {
    return /(Mozilla|AppleWebKit|Chrome|Gecko|Safari)/.test(req.headers['user-agent']);
  };

  clientRes = function(res, response, httpcode) {
    httpcode || (httpcode = 200);
    res.writeHead(httpcode, {
      'content-type': 'application/json'
    });
    return res.end(JSON.stringify(response));
  };

  errorRes = function(res, req, err, message) {
    if ((err != null) && (err.stack != null)) {
      console.log(err.stack);
    } else if (err != null) {
      console.log(err);
    }
    if (isBrowser(req)) {
      res.render('index', {
        locals: {
          pageTitle: "Shock - main",
          message: message
        }
      });
    }
    if (!isBrowser(req)) {
      return clientRes(res, {
        "message": message,
        "status": "Error"
      });
    }
  };

  uncouchdb = function(doc) {
    var k, tmp, v;
    tmp = {};
    for (k in doc) {
      v = doc[k];
      tmp[k.replace(/^_/, "")] = v;
    }
    return tmp;
  };

  recouchdb = function(doc) {
    var k, tmp, v;
    tmp = {};
    for (k in doc) {
      v = doc[k];
      if (k === 'id' || k === 'rev') {
        tmp["_" + k] = v;
      } else {
        tmp[k.replace(/^_/, "")] = v;
      }
    }
    return tmp;
  };

}).call(this);
