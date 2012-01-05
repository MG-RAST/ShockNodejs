##########################################################################
#                   Shock - OSDF reference implementation                               
# Authors:  
#     Jared Wilkening (jared at mcs.anl.gov)
#     Narayan Desai   (desai at mcs.anl.gov)
#     Folker Meyer    (folker at anl.gov)
##########################################################################

cluster = require 'cluster'
Server  = require './lib/Server'
Routes  = require './lib/Routes'
Shock   = require './lib/Shock'

##########################################################################
# multiprocess setup - currently causes upload conflicts
##########################################################################
###
processes = 2
if cluster.isMaster
	for [1..processes]
		cluster.fork()
	
	cluster.on 'death', (worker)->
	    console.log "worker #{worker.pid} died"
else

##########################################################################
# init server (pulls in conf/server.conf)
##########################################################################
server = new Server()
shock  = new Shock(server)
routes = new Routes(server, shock)	

# routes definition
server.get '/',         (req, res)-> routes.index req, res
server.get '/paginate', (req, res)-> routes.browse req, res
server.get '/node',     (req, res)-> routes.get req,res
server.get '/node/:id', (req, res)-> routes.get req,res
# /?download - complete file download
# /?download&index=$index&part=$part - file part download
# /?list&indexes - index parts list
# /?list&index=$index - index parts list

server.put '/node/:id', (req, res)-> routes.put req,res
# / multipart-form containing: file (will not replace), attributes (json file: will replace)
# /?attribute1=value&attribute2=value (will replace / insert)
# /?attributes - attributes (json file: will replace)

server.post '/node/:id', (req, res)-> routes.post req,res
# / multipart-form containing: file, attributes (json file)
# / empty body 
# /?index=$indextype - triggers index creation
# /?file - upload full file (will not replace)
# /?file&part=$part - upload file part (will not replace)
# /?attributes - attributes (json file: will not replace)

server.delete '/node/:id', (req, res)-> routes.del req,res

server.get '/indexes', (req, res)-> routes.indexes req,res
# lists index types

server.get  '/register', (req, res)-> routes.register req,res
server.post '/register', (req, res)-> routes.register req,res
# / multipart-form containing: file, attributes (json file)
# / empty body

# start server
server.start()	




