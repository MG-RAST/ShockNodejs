(function() {
  var File, Nodes, Shock;

  Nodes = require("./Nodes");

  File = require("./File");

  Shock = (function() {

    function Shock(server) {
      this.server = server;
      this.nodes = new Nodes(this.server);
      this.file = new File(this.server);
    }

    return Shock;

  })();

  module.exports = Shock;

}).call(this);
