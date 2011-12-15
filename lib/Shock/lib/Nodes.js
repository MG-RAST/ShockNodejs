(function() {
  var Nodes, createNodeDir, deconstruct, deleteNodeDir, dirHash, exec, fs, getSet, levelSort, reconstruct, rmdirRecursive, typeOf, util;

  util = require('util');

  fs = require('fs');

  exec = require('child_process').exec;

  Nodes = (function() {

    function Nodes(server) {
      this.server = server;
    }

    Nodes.prototype.create = function(attributes, cb) {
      var _this = this;
      if (typeof cb !== 'function') {
        throw new Error("Nodes.create can not be called without a callback");
      }
      return this.server.query("insert into nodes (id) values (default) returning id", [], function(err, results) {
        var attrRows, container, id, index, insertRows, row, tag, value, values, _i, _len;
        if (err != null) return cb(err, null);
        if ((results.rows != null) && (results.rows[0].id != null)) {
          id = results.rows[0].id;
          values = [];
          attrRows = deconstruct(attributes);
          if (attrRows.length > 0) {
            insertRows = [];
            for (_i = 0, _len = attrRows.length; _i < _len; _i++) {
              row = attrRows[_i];
              index = row[1] != null ? "'" + row[1] + "'" : 'NULL';
              container = row[2] != null ? "'" + row[2] + "'" : 'NULL';
              tag = row[3] != null ? "'" + row[3] + "'" : 'NULL';
              value = row[4] != null ? "'" + row[4] + "'" : 'NULL';
              insertRows.push("(" + id + ", " + row[0] + ", " + index + ", " + container + ", " + tag + ", " + value + ")");
            }
            return _this.server.query("insert into attributes (node_id, level, index, container, tag, value) values " + (insertRows.join(', ')), [], function(err, results) {
              if (err != null) console.log(err);
              return _this.get(id, cb);
            });
          } else {
            return _this.get(id, cb);
          }
        } else {
          return cb("Could not create node, unknown error", null);
        }
      });
    };

    Nodes.prototype.update = function(id, attributes, cb) {
      var _this = this;
      if (typeof cb !== 'function') {
        throw new Error("Nodes.create can not be called without a callback");
      }
      return this.server.query("select id from nodes where id = $1", [id], function(err, results) {
        if (err != null) return cb(err, false);
        if ((results.rows != null) && (results.rows[0] != null)) {
          return cb(null, true);
        } else {
          return cb("node not found", false);
        }
      });
    };

    Nodes.prototype.get = function(id, cb) {
      var _this = this;
      if (typeof cb === !'function') {
        throw "Nodes.get can not be called without a callback";
      }
      return this.server.query("select * from nodes where id = $1", [id], function(err, results) {
        var node;
        if (err != null) return cb(err, null);
        if (!(results.rows != null) || results.rows.length === 0) {
          return cb("node not found", null);
        }
        node = results.rows[0];
        return _this.server.query("select level, index, container, tag, value from attributes where node_id = $1 order by id asc", [id], function(err, results) {
          var attrRows, attributes, row, _i, _len, _ref;
          attrRows = [];
          _ref = results.rows;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            row = _ref[_i];
            attrRows.push([row.level, row.index, row.container, row.tag, row.value]);
          }
          attributes = reconstruct(attrRows);
          node.attributes = attributes;
          return _this.server.query("select S.name as scope_name, A.read, A.write, A.del from (select * from acls where node_id = $1) as A join (select * from scopes) as S on A.scope_id = S.id", [id], function(err, results) {
            var acl, row, _j, _len2, _ref2;
            acl = {
              "read": [],
              "write": [],
              "delete": []
            };
            _ref2 = results.rows;
            for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
              row = _ref2[_j];
              if (row.read) acl.read.push(row.scope_name);
              if (row.write) acl.write.push(row.scope_name);
              if (row.del) acl["delete"].push(row.scope_name);
            }
            node.acl = acl;
            return cb(null, node);
          });
        });
      });
    };

    Nodes.prototype["delete"] = function(id, cb) {
      var _this = this;
      return this.server.query("delete from attributes where node_id = $1", [id], function(err, results) {
        if (err != null) return cb(err);
        return _this.server.query("delete from indexes where node_id = $1", [id], function(err, results) {
          if (err != null) return cb(err);
          return _this.server.query("delete from acls where node_id = $1", [id], function(err, results) {
            if (err != null) return cb(err);
            return _this.server.query("delete from nodes where id = $1", [id], function(err, results) {
              if (err != null) return cb(err);
              return cb(null);
            });
          });
        });
      });
    };

    Nodes.prototype.query = function(attributes, limit, offset, cb) {
      var limit_offset;
      var _this = this;
      limit_offset = "";
      if ((limit != null) && limit > 0 && (offset != null) && offset >= 0) {
        limit_offset = "limit " + limit + " offset " + offset;
      }
      return this.server.query("select * from nodes order by id " + limit_offset, [], function(err, results) {
        var idSet, nodes, r, _i, _len, _ref;
        if (err != null) return cb(err, null);
        if ((results.rows != null) && results.rows.length > 0) {
          nodes = {};
          idSet = [];
          _ref = results.rows;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            r = _ref[_i];
            idSet.push(r.id);
            nodes[r.id] = r;
            nodes[r.id]['acl'] = {};
          }
          return _this.server.query("select node_id, level, index, container, tag, value from attributes where node_id in (" + (idSet.join(', ')) + ")", [], function(err, results) {
            var attrRows, id, n, nodeAttrRows, row, _j, _len2, _ref2;
            if (err != null) return cb(err, null);
            if ((results.rows != null) && results.rows.length > 0) {
              nodeAttrRows = {};
              _ref2 = results.rows;
              for (_j = 0, _len2 = _ref2.length; _j < _len2; _j++) {
                row = _ref2[_j];
                if (!(nodeAttrRows[row.node_id] != null)) {
                  nodeAttrRows[row.node_id] = [];
                }
                nodeAttrRows[row.node_id].push([row.level, row.index, row.container, row.tag, row.value]);
              }
              for (id in nodeAttrRows) {
                attrRows = nodeAttrRows[id];
                nodes[id]["attributes"] = reconstruct(attrRows);
              }
            }
            for (n in nodes) {
              if (nodes[n]['attributes'] == null) nodes[n]['attributes'] = {};
            }
            return _this.server.query("select A.node_id, S.name as scope_name, A.read, A.write, A.del from (select * from acls where node_id in (" + (idSet.join(', ')) + ")) as A join (select * from scopes) as S on A.scope_id = S.id", [], function(err, results) {
              var acls, id, n, node, queryResults, row, _k, _len3, _ref3;
              if (err != null) return cb(err, null);
              acls = {};
              _ref3 = results.rows;
              for (_k = 0, _len3 = _ref3.length; _k < _len3; _k++) {
                row = _ref3[_k];
                if (!(acls[row.node_id] != null)) {
                  acls[row.node_id] = {
                    'read': [],
                    'write': [],
                    'delete': []
                  };
                }
                if (row.read) acls[row.node_id]['read'].push(row.scope_name);
                if (row.write) acls[row.node_id]['write'].push(row.scope_name);
                if (row.del) acls[row.node_id]['delete'].push(row.scope_name);
              }
              for (n in nodes) {
                if (acls[n] != null) {
                  nodes[n]['acl'] = acls[n];
                } else {
                  nodes[n]['acl'] = {
                    'read': [],
                    'write': [],
                    'delete': []
                  };
                }
              }
              queryResults = [];
              for (id in nodes) {
                node = nodes[id];
                queryResults.push(node);
              }
              return cb(null, queryResults);
            });
          });
        }
      });
    };

    Nodes.prototype.count = function(cb) {
      var _this = this;
      return this.server.query("select count(id) from nodes", [], function(err, results) {
        if (err != null) return cb(err, null);
        if ((results.rows != null) && results.rows.length > 0) {
          return cb(null, results.rows[0].count);
        } else {
          return cb(null, 0);
        }
      });
    };

    Nodes.prototype.dir = function(id) {
      return "" + this.server.data_root + "/" + (dirHash(id)) + "/" + id;
    };

    Nodes.prototype.checksum = function(id, cb) {
      var _this = this;
      return this.server.query("select id, checksum from nodes where id = $1", [id], function(err, results) {
        if (err != null) return cb(err, null);
        if ((results.rows != null) && results.rows.length > 0) {
          return cb(null, results.rows[0].checksum);
        } else {
          return cb(null, null);
        }
      });
    };

    return Nodes;

  })();

  module.exports = Nodes;

  createNodeDir = function(root, id, cb) {
    return fs.stat("" + root + "/" + (dirHash(id)), function(err, stats) {
      var path;
      if (stats != null) {
        path = "" + root + "/" + (dirHash(id)) + "/" + id;
        return rmdirRecursive(path, function(err) {
          if (err != null) return cb(err);
          return fs.mkdir(path, function(err) {
            if (err != null) return cb(err);
            return cb(null);
          });
        });
      } else {
        return fs.mkdir("" + root + "/" + (dirHash(id)), function(err) {
          if (err != null) return cb(err);
          return fs.mkdir("" + root + "/" + (dirHash(id)) + "/" + id, function(err) {
            if (err != null) return cb(err);
            return cb(null);
          });
        });
      }
    });
  };

  deleteNodeDir = function(root, id, cb) {
    return rmdirRecursive("" + root + "/" + (dirHash(id)) + "/" + id, function(err) {
      if (err != null) return cb(err);
      return cb(null);
    });
  };

  dirHash = function(id) {
    var hash;
    hash = ("" + id).substring(("" + id).length - 2);
    if (hash.length === 1) return "0" + hash;
    return hash;
  };

  rmdirRecursive = function(path, cb) {
    return fs.stat(path, function(err, stats) {
      if (stats != null) {
        return exec("rm -r " + path, function(err, stdout, stderr) {
          if (err != null) return cb(stderr);
          return cb(null);
        });
      } else {
        return cb(null);
      }
    });
  };

  getSet = function(nodes, set, results, cb) {
    var id;
    if (set.length > 0) {
      id = set.shift();
      return nodes.get(id, function(err, node) {
        if (err != null) return cb(err, results);
        results.push(node);
        return getSet(nodes, set, results, cb);
      });
    } else {
      return cb(null, results);
    }
  };

  /*
  {
  	foo : {
  		foo : bar,
  		foo2 : bar 
  	}
  	foo3 : bar,
  	foo4 : [bas, bas, bas, bas]
   }
  
  node_id | level | index | container | tag  | value 
        1 |     0 |       | m         | foo  | 1
        1 |     0 |       |           | foo3 | bar
        1 |     0 |       | a         | foo4 | 2
        1 |     1 |       |           | foo  | bar
        1 |     1 |       |           | foo2 | bar
        1 |     2 |     0 |           | foo4 | bas
        1 |     2 |     1 |           | foo4 | bas
        1 |     2 |     2 |           | foo4 | bas
        1 |     2 |     3 |           | foo4 | bas
  */

  deconstruct = function(json) {
    var key, level, rows, value;
    rows = [];
    if (typeOf(json) === !'object') return "invalid object";
    level = 0;
    for (key in json) {
      value = json[key];
      rows.insert(0, null, key, value);
    }
    return rows;
  };

  reconstruct = function(rows) {
    var container, json, levels, row;
    json = {};
    levels = {
      '0': json
    };
    while (rows.length > 0) {
      row = rows.shift();
      if (levels[row[0]] != null) {
        if (row[2] != null) {
          container = row[2] === 'a' ? [] : {};
          if (row[1] != null) {
            levels[row[0]][row[1]] = container;
            levels[row[4]] = levels[row[0]][row[1]];
          } else {
            levels[row[0]][row[3]] = container;
            levels[row[4]] = levels[row[0]][row[3]];
          }
        } else {
          if (row[1] != null) {
            levels[row[0]][row[1]] = row[4];
          } else {
            levels[row[0]][row[3]] = row[4];
          }
        }
      } else {
        rows.push(row);
      }
    }
    return json;
  };

  levelSort = function(a, b) {
    return a[0] - b[0];
  };

  Array.prototype.insert = function(level, index, key, value) {
    var i, k, nextLevel, tmpindex, v, _i, _len, _results, _results2;
    switch (typeOf(value)) {
      case 'array':
        tmpindex = 0;
        nextLevel = this.maxLevel() + 1;
        this.push([level, index, 'a', key, nextLevel]);
        _results = [];
        for (_i = 0, _len = value.length; _i < _len; _i++) {
          i = value[_i];
          this.insert(nextLevel, tmpindex, key, i);
          _results.push(tmpindex++);
        }
        return _results;
        break;
      case 'object':
        nextLevel = this.maxLevel() + 1;
        this.push([level, index, 'm', key, nextLevel]);
        _results2 = [];
        for (k in value) {
          v = value[k];
          _results2.push(this.insert(nextLevel, null, k, v));
        }
        return _results2;
        break;
      default:
        return this.push([level, index, null, key, value]);
    }
  };

  Array.prototype.maxLevel = function() {
    var max, r, _i, _len, _ref;
    max = 0;
    for (_i = 0, _len = this.length; _i < _len; _i++) {
      r = this[_i];
      if (r[0] > max) max = r[0];
      if ((_ref = r[2]) === 'm' || _ref === 'a') if (r[4] > max) max = r[4];
    }
    return max;
  };

  typeOf = function(obj) {
    if (typeof obj === 'object') {
      if (obj.push) return 'array';
      return 'object';
    } else {
      return typeof obj;
    }
  };

}).call(this);
