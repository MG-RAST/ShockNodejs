(function() {
  var checkPending, checksumFile, clientRes, exec, formidable, fs, getChunkHelper, http, isBrowser, putHelper, sys, updateObject, util;
  var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };
  formidable = require('formidable');
  sys = require('sys');
  fs = require('fs');
  http = require('http');
  util = require('util');
  exec = require('child_process').exec;
  exports.Handler = (function() {
    function Handler(server) {
      this.query = __bind(this.query, this);;      this.server = server;
    }
    Handler.prototype.status = function(req, res) {
      return this.server.query("select O.obj_key as key, O.obj_name as name, O.pending_index as index_pending, O.file_size as size, O.file_checksum as checksum, O.pending_upload as upload_pending, O.creation as creation, U.parts as total_parts, U.incomplete as parts_uploaded from objects as O join (select A.obj_key as obj_key, A.parts, B.parts as incomplete from (select obj_key, count(part) as parts from pending_uploads group by obj_key) as A left join (select obj_key, count(part) as parts from pending_uploads where file_name is not null group by obj_key) as B on A.obj_key = B.obj_key) as U on O.obj_key = U.obj_key", [], function(results) {
        var c, columns, r, rows, tmp, _i, _j, _len, _len2, _ref;
        columns = ['key', 'name', 'size', 'checksum', 'upload_pending', 'total_parts', 'parts_uploaded', 'index_pending', 'creation'];
        rows = [];
        _ref = results.rows;
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          r = _ref[_i];
          tmp = [];
          for (_j = 0, _len2 = columns.length; _j < _len2; _j++) {
            c = columns[_j];
            tmp.push(r[c]);
          }
          rows.push(tmp);
        }
        if (isBrowser(req)) {
          res.render('index', {
            locals: {
              pageTitle: "Shock - main",
              columns: columns,
              rows: rows
            }
          });
        }
        if (!isBrowser(req)) {
          return clientRes(res, {
            "datasetcount": rows.length,
            "columns": columns,
            "rows": rows
          });
        }
      });
    };
    Handler.prototype.register = function(req, res, reqType) {
      var form;
      if (reqType === 'get') {
        return res.render('register', {
          locals: {
            pageTitle: "Shock - Register"
          }
        });
      } else {
        form = formidable.IncomingForm();
        return form.parse(req, __bind(function(err, fields, files) {
          if (err != null) {
            console.log(err);
          }
          fields.name || (fields.name = null);
          fields.parts || (fields.parts = 1);
          return this.server.query("insert into objects(obj_name) values($1) returning obj_key", [fields.name], __bind(function(results) {
            var i, mode, obj_key, _ref;
            obj_key = results.rows[0].obj_key;
            for (i = 1, _ref = fields.parts; (1 <= _ref ? i <= _ref : i >= _ref); (1 <= _ref ? i += 1 : i -= 1)) {
              this.server.query("insert into pending_uploads(obj_key, part) values($1, $2)", [obj_key, i]);
            }
            fs.mkdir(this.server.data_root + '/' + obj_key, mode = 0777);
            if (isBrowser(req)) {
              res.render('register', {
                locals: {
                  pageTitle: "Shock - Register",
                  id: obj_key
                }
              });
            }
            if (!isBrowser(req)) {
              return clientRes(res, {
                "obj_key": obj_key
              });
            }
          }, this));
        }, this));
      }
    };
    Handler.prototype.info = function(req, res) {
      var id;
      id = req.params.id;
      return this.server.query("select * from objects where obj_key = $1", [id], __bind(function(results) {
        var info_obj, k, stats, v, _ref;
        info_obj = {};
        if (results.rows.length > 0) {
          _ref = this.server.indexes;
          for (k in _ref) {
            v = _ref[k];
            stats = fs.statSync("" + this.server.data_root + "/" + id + "/" + id + "." + v);
            info_obj["" + k + "_count"] = stats.size / 22;
          }
          if (isBrowser(req)) {
            res.render('index', {
              locals: {
                pageTitle: "Shock - main",
                message: "[Info] obj_key : " + req.params.id + ", records : " + info_obj.record_count + ", megabases : " + info_obj.megabase_count + ", megabytes : " + info_obj.megabyte_count
              }
            });
          }
          if (!isBrowser(req)) {
            return clientRes(res, {
              'obj_key': req.params.id,
              'info': info_obj
            });
          }
        } else {
          if (isBrowser(req)) {
            res.render('index', {
              locals: {
                pageTitle: "Shock - main",
                message: "Could not find " + req.params.id
              }
            });
          }
          if (!isBrowser(req)) {
            return clientRes(res, {
              "message": "Could not find " + req.params.id,
              "status": "Error"
            });
          }
        }
      }, this));
    };
    Handler.prototype.put = function(req, res, reqType) {
      if (reqType === 'get') {
        if (req.params.part != null) {
          return res.render('upload', {
            locals: {
              pageTitle: "Shock - upload",
              id: req.params.id,
              part: req.params.part
            }
          });
        } else {
          return res.render('upload', {
            locals: {
              pageTitle: "Shock - upload",
              id: req.params.id
            }
          });
        }
      } else if (reqType === 'post') {
        if ((req.params.id != null) && (req.params.part != null)) {
          return putHelper(this.server, req, res, req.params.id, req.params.part);
        } else {
          return putHelper(this.server, req, res);
        }
      }
    };
    Handler.prototype.getComplete = function(req, res) {
      return this.server.query("select * from objects where obj_key = $1", [req.params.id], __bind(function(results) {
        if (results.rows.length > 0) {
          if (!results.rows[0].pending_upload) {
            return fs.stat("" + this.server.data_root + "/" + results.rows[0].obj_key + "/" + results.rows[0].file_name, __bind(function(err, stats) {
              if (err) {
                if (isBrowser(req)) {
                  res.render('index', {
                    locals: {
                      pageTitle: "Shock - main",
                      message: "Internal error: file doesn't exist"
                    }
                  });
                }
                if (!isBrowser(req)) {
                  clientRes(res, {
                    "message": "internal error: file doesn't exist",
                    "status": "Error"
                  });
                }
                return console.log(err);
              } else {
                res.writeHead(200, {
                  'content-type': 'application/octet-stream',
                  'content-length': results.rows[0].file_size,
                  'content-md5': results.rows[0].file_checksum,
                  'content-disposition': ":attachment;filename=" + results.rows[0].file_name
                });
                return fs.createReadStream("" + this.server.data_root + "/" + results.rows[0].obj_key + "/" + results.rows[0].file_name).addListener("data", function(chunk) {
                  return res.write(chunk);
                }).addListener("end", function() {
                  return res.end();
                });
              }
            }, this));
          } else {
            if (isBrowser(req)) {
              res.render('index', {
                locals: {
                  pageTitle: "Shock - main",
                  message: "Object still pending upload"
                }
              });
            }
            if (!isBrowser(req)) {
              return clientRes(res, {
                "message": "object still pending upload",
                "status": "Error"
              });
            }
          }
        } else {
          if (isBrowser(req)) {
            res.render('index', {
              locals: {
                pageTitle: "Shock - main",
                message: "Object not found for obj_key: " + req.params.id
              }
            });
          }
          if (!isBrowser(req)) {
            return clientRes(res, {
              "message": "object not found for obj_key: " + req.params.id,
              "status": "Error"
            });
          }
        }
      }, this));
    };
    Handler.prototype.getChunk = function(req, res) {
      var cords;
      cords = req.params.start.split(":");
      if (cords.length === 1) {
        return getChunkHelper(this.server, req, res, req.params.id, req.params.index, parseInt(cords[0]), parseInt(cords[0]));
      } else if (cords.length === 2) {
        return getChunkHelper(this.server, req, res, req.params.id, req.params.index, parseInt(cords[0]), parseInt(cords[1]));
      } else {
        if (isBrowser(req)) {
          res.render('index', {
            locals: {
              pageTitle: "Shock - main",
              message: "You are doing it wrong"
            }
          });
        }
        if (!isBrowser(req)) {
          return clientRes(res, {
            "message": "You are doing it wrong",
            "status": "Error"
          });
        }
      }
    };
    Handler.prototype.del = function(req, res) {
      return this.server.query('select * from objects where obj_key = $1', [req.params.id], __bind(function(results) {
        if (results.rows.length === 1) {
          this.server.query('delete from objects where obj_key = $1', [req.params.id]);
          exec("rm -rf " + this.server.data_root + "/" + req.params.id, function(error, stdout, stderr) {
            if (error != null) {
              return console.log(error);
            }
          });
          if (isBrowser(req)) {
            res.render('index', {
              locals: {
                pageTitle: "Shock - main",
                message: req.params.id + ": successfully deleted."
              }
            });
          }
          if (!isBrowser(req)) {
            return clientRes(res, {
              "status": "Ok",
              "message": req.params.id + ": successfully deleted."
            });
          }
        } else {
          if (isBrowser(req)) {
            res.render('index', {
              locals: {
                pageTitle: "Shock - main",
                message: "Object not found for obj_key: " + req.params.id
              }
            });
          }
          if (!isBrowser(req)) {
            return clientRes(res, {
              "status": "Error",
              "message": "object not found for obj_key: " + req.params.id
            });
          }
        }
      }, this));
    };
    Handler.prototype.query = function(req, res) {
      return res.render('index', {
        locals: {
          pageTitle: "Shock - Register"
        }
      });
    };
    return Handler;
  })();
  isBrowser = function(req) {
    return /(Mozilla|AppleWebKit|Chrome|Gecko|Safari)/.test(req.headers['user-agent']);
  };
  clientRes = function(res, response, httpcode) {
    httpcode || (httpcode = 200);
    res.writeHead(httpcode, {
      'content-type': 'application/json'
    });
    return res.end(JSON.stringify({
      "service": ["Shock", "shock.mcs.anl.gov", "Ok"],
      "response": response
    }));
  };
  putHelper = function(server, req, res, id, part) {
    var form;
    form = new formidable.IncomingForm();
    return form.parse(req, function(err, fields, files) {
      var obj_key, pending_part;
      if (err) {
        return console.log(err);
      }
      obj_key = id != null ? id : (fields != null) && fields.id ? fields.id : null;
      pending_part = part != null ? part : (fields != null) && fields.part ? fields.part : null;
      if (obj_key && pending_part) {
        return server.query("select * from objects where obj_key = $1 and pending_upload", [obj_key], function(results) {
          if ((results.rows != null) && results.rows.length === 0) {
            if (isBrowser(req)) {
              res.render('index', {
                locals: {
                  pageTitle: "Shock - main",
                  message: "Upload refused"
                }
              });
            }
            if (!isBrowser(req)) {
              return clientRes(res, {
                "message": "refused",
                "obj_key": obj_key
              });
            }
          } else {
            return server.query("select file_checksum from pending_uploads where obj_key = $1 and part = $2 and file_name is Null", [obj_key, pending_part], function(results) {
              if ((results.rows != null) && results.rows.length === 0) {
                if (isBrowser(req)) {
                  res.render('index', {
                    locals: {
                      pageTitle: "Shock - main",
                      message: "Upload refused"
                    }
                  });
                }
                if (!isBrowser(req)) {
                  return clientRes(res, {
                    "message": "refused",
                    "obj_key": obj_key,
                    "part": pending_part
                  });
                }
              }
              return exec("mv " + files.upload.path + " " + server.data_root + "/" + obj_key + "/" + obj_key + ".part." + pending_part, function(error, stdout, stderr) {
                if (error) {
                  return console.log(error);
                }
                if (server.checksum_files) {
                  return checksumFile("" + server.data_root + "/" + obj_key + "/" + obj_key + ".part." + pending_part, function(err, checksum) {
                    if (err) {
                      if (isBrowser(req)) {
                        res.render('index', {
                          locals: {
                            pageTitle: "Shock - main",
                            message: "Internal error: Could not calculate the md5 checksum of upload"
                          }
                        });
                      }
                      if (!isBrowser(req)) {
                        return clientRes(res, {
                          "status": "Error",
                          "message": "internal error: Could not calculate the md5 checksum of upload",
                          "obj_key": obj_key,
                          "part": pending_part
                        });
                      }
                    } else {
                      server.query("update pending_uploads set (file_name, file_size, file_checksum) = ($1,$2,$3) where obj_key = $4 and part = $5", [files.upload.filename, files.upload.length, checksum, obj_key, pending_part], function(results) {
                        return checkPending(server, obj_key);
                      });
                      if (isBrowser(req)) {
                        res.render('upload', {
                          locals: {
                            pageTitle: "Shock - upload",
                            id: obj_key,
                            status: 'success'
                          }
                        });
                      }
                      if (!isBrowser(req)) {
                        return clientRes(res, {
                          "message": "success",
                          "obj_key": obj_key,
                          "part": pending_part,
                          "checksum": checksum
                        });
                      }
                    }
                  });
                } else {
                  server.query("update pending_uploads set (file_name, file_size) = ($1,$2) where obj_key = $3 and part = $4", [files.upload.filename, files.upload.length, obj_key, pending_part], function(results) {
                    return checkPending(server, obj_key);
                  });
                  if (isBrowser(req)) {
                    res.render('upload', {
                      locals: {
                        pageTitle: "Shock - upload",
                        id: obj_key,
                        status: 'success'
                      }
                    });
                  }
                  if (!isBrowser(req)) {
                    return clientRes(res, {
                      "message": "success",
                      "obj_key": obj_key,
                      "part": pending_part
                    });
                  }
                }
              });
            });
          }
        });
      } else {
        if (isBrowser(req)) {
          res.render('upload', {
            locals: {
              pageTitle: "Shock - upload",
              status: 'error'
            }
          });
        }
        if (!isBrowser(req)) {
          return clientRes(res, {
            "message": "error"
          });
        }
      }
    });
  };
  getChunkHelper = function(server, req, res, id, index, start, end) {
    if (index === 'record' || index === 'megabyte' || index === 'megabase') {
      return server.query("select * from objects where obj_key = $1", [req.params.id], function(results) {
        if (results.rows.length > 0) {
          if (!results.rows[0].pending_index) {
            return fs.open("" + server.data_root + "/" + id + "/" + id + "." + server.indexes[index], "r", function(err, fd) {
              var readbuffer;
              if (err) {
                console.log(err);
                if (isBrowser(req)) {
                  res.render('index', {
                    locals: {
                      pageTitle: "Shock - main",
                      message: "Internal error"
                    }
                  });
                }
                if (!isBrowser(req)) {
                  clientRes(res, {
                    "message": "Internal error",
                    "status": "Error"
                  });
                }
              } else {
                readbuffer = new Buffer(100);
                return fs.read(fd, readbuffer, 0, 22, 22 * (start - 1), function(err, bytesRead, startbuffer) {
                  var length, offset, startoffset;
                  if (err || !(Buffer.isBuffer(startbuffer) && bytesRead === 22)) {
                    console.log(err || "blah");
                    if (isBrowser(req)) {
                      res.render('index', {
                        locals: {
                          pageTitle: "Shock - main",
                          message: "Internal error"
                        }
                      });
                    }
                    if (!isBrowser(req)) {
                      clientRes(res, {
                        "message": "Internal error",
                        "status": "Error"
                      });
                    }
                    return;
                  }
                  if (start < end) {
                    startoffset = parseInt(startbuffer.slice(0, 13).toString('utf-8').replace(/0+/, "")) || 0;
                    return fs.read(fd, readbuffer, 0, 22, 22 * (end - 1), function(err, bytesRead, endbuffer) {
                      var endlength, endoffset;
                      if (err || !(Buffer.isBuffer(endbuffer) && bytesRead === 22)) {
                        console.log(err || "blah");
                        if (isBrowser(req)) {
                          res.render('index', {
                            locals: {
                              pageTitle: "Shock - main",
                              message: "Internal error"
                            }
                          });
                        }
                        if (!isBrowser(req)) {
                          clientRes(res, {
                            "message": "Internal error",
                            "status": "Error"
                          });
                        }
                        return;
                      }
                      endoffset = parseInt(endbuffer.slice(0, 13).toString('utf-8').replace(/0+/, "")) || 0;
                      endlength = parseInt(endbuffer.slice(13, 21).toString('utf-8').replace(/0+/, "")) || 0;
                      /*res.writeHead 200,
                      											'content-type': 'application/octet-stream',
                      											'content-length' : length,
                      											'content-disposition': ":attachment;filename=#{id}_#{start}_#{end}"*/
                      return fs.createReadStream("" + server.data_root + "/" + id + "/" + id, {
                        start: startoffset,
                        end: endoffset + endlength,
                        'encoding': 'utf-8',
                        'bufferSize': 1024
                      }).addListener("data", function(chunk) {
                        return res.write(chunk);
                      }).addListener("end", function() {
                        return res.end();
                      });
                    });
                  } else if (start === end) {
                    offset = parseInt(startbuffer.slice(0, 13).toString('utf-8').replace(/0+/, "")) || 0;
                    length = parseInt(startbuffer.slice(13, 21).toString('utf-8').replace(/0+/, "")) || 0;
                    /*res.writeHead 200,
                    										'content-type': 'application/octet-stream',
                    										'content-length' : length,
                    										'content-disposition': ":attachment;filename=#{id}_#{start}_#{end}"*/
                    return fs.createReadStream("" + server.data_root + "/" + id + "/" + id, {
                      start: offset,
                      end: offset + length,
                      'encoding': 'utf-8',
                      'bufferSize': 1024
                    }).addListener("data", function(chunk) {
                      return res.write(chunk);
                    }).addListener("end", function() {
                      return res.end();
                    });
                  } else {
                    if (isBrowser(req)) {
                      res.render('index', {
                        locals: {
                          pageTitle: "Shock - main",
                          message: "Invalid record range"
                        }
                      });
                    }
                    if (!isBrowser(req)) {
                      return clientRes(res, {
                        "message": "Invalid record range",
                        "status": "Error"
                      });
                    }
                  }
                });
              }
            });
          } else {
            if (isBrowser(req)) {
              res.render('index', {
                locals: {
                  pageTitle: "Shock - main",
                  message: "Object still pending indexing"
                }
              });
            }
            if (!isBrowser(req)) {
              return clientRes(res, {
                "message": "object still pending indexing",
                "status": "Error"
              });
            }
          }
        } else {
          if (isBrowser(req)) {
            res.render('index', {
              locals: {
                pageTitle: "Shock - main",
                message: "Object not found for obj_key: " + id
              }
            });
          }
          if (!isBrowser(req)) {
            return clientRes(res, {
              "message": "object not found for obj_key: " + id,
              "status": "Error"
            });
          }
        }
      });
    } else {
      if (isBrowser(req)) {
        res.render('index', {
          locals: {
            pageTitle: "Shock - main",
            message: "invalid index type " + req.params.index
          }
        });
      }
      if (!isBrowser(req)) {
        return clientRes(res, {
          "message": "invalid index type " + req.params.index
        });
      }
    }
  };
  checkPending = function(server, obj_key) {
    return server.query("select * from pending_uploads where obj_key = $1 and file_name is null", [obj_key], function(results) {
      var files;
      if (results.rows.length === 0) {
        files = "";
        updateObject(server, obj_key, 'pending_upload', 'FALSE');
        return server.query("select * from pending_uploads where obj_key = $1", [obj_key], function(results) {
          var r, _i, _len, _ref;
          _ref = results.rows;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            r = _ref[_i];
            files += " " + server.data_root + "/" + obj_key + "/" + obj_key + ".part." + r.part;
          }
          return exec("cat " + files + " > " + server.data_root + "/" + obj_key + "/" + obj_key, function(error, stdout, stderr) {
            if (error) {
              return console.log(error);
            }
            exec("rm " + files, function(error, stdout, stderr) {
              if (error != null) {
                return console.log(error);
              }
            });
            updateObject(server, obj_key, 'file_name', obj_key);
            fs.stat("" + server.data_root + "/" + obj_key + "/" + obj_key, function(err, stats) {
              if (err) {
                return console.log(err);
              }
              return updateObject(server, obj_key, 'file_size', stats.size);
            });
            if (server.checksum_files) {
              checksumFile("" + server.data_root + "/" + obj_key + "/" + obj_key, function(err, file_checksum) {
                if (!err) {
                  return updateObject(server, obj_key, 'file_checksum', file_checksum);
                }
              });
            }
            return exec("./shockUtil -c index -f " + server.data_root + "/" + obj_key + "/" + obj_key + " -o " + server.data_root + "/" + obj_key + "/" + obj_key, function(error, stdout, stderr) {
              if (error != null) {
                console.log(error);
              }
              return updateObject(server, obj_key, 'pending_index', false);
            });
          });
        });
      }
    });
  };
  updateObject = function(server, obj_key, col, value) {
    return server.query("update objects set " + col + " = $1 where obj_key = $2", [value, obj_key]);
  };
  checksumFile = function(file, callback) {
    return exec("./shockUtil -c checksum -f " + file, function(error, checksum, stderr) {
      if (typeof callback === 'function') {
        if (error != null) {
          console.log("error: " + error + " , stderr: " + stderr);
          return callback(1, null);
        } else {
          return callback(null, checksum);
        }
      } else {
        if (error != null) {
          console.log(error);
        }
        if (stderr != null) {
          console.log(stderr);
        }
        return console.log(checksum);
      }
    });
  };
}).call(this);
