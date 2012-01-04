##########################################################################
#                   Shock - OSDF reference implementation                               
# Authors:  
#     Jared Wilkening (jared at mcs.anl.gov)
#     Narayan Desai   (desai at mcs.anl.gov)
#     Folker Meyer    (folker at anl.gov)
##########################################################################

Nodes = require "./Nodes"
File  = require "./File"

##########################################################################
# Shock class
##########################################################################

class Shock
	constructor: (server)->
		@server = server
		@nodes  = new Nodes @server 
		@file   = new File @server
		
##########################################################################
# exports
##########################################################################

module.exports = Shock