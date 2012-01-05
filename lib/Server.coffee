##########################################################################
#                   Shock - OSDF reference implementation                               
# Authors:  
#     Jared Wilkening (jared at mcs.anl.gov)
#     Narayan Desai   (desai at mcs.anl.gov)
#     Folker Meyer    (folker at anl.gov)
##########################################################################

express	= require 'express'
fs		= require 'fs'
pg		= require('pg').native
pg.defaults.poolSize = 50

##########################################################################
# Server class
##########################################################################

class Server
	constructor: ()->
		try 
			@conf  = JSON.parse fs.readFileSync "conf/server.conf", 'utf8'
		catch err
			console.log err

		@url            = @conf.url			
		@name           = @conf.name
		@port			= @conf.port		
		@data_root 	 	= @conf.data_root
		@dbconnect		= "pg://#{@conf.dbuser}#{if @conf.dbpasswd? then ":#{@conf.dbpasswd}" else "" }@#{@conf.dbhost}/#{@conf.dbname}"
		@upload_dir     = @conf.upload_dir
		@checksum_type  = @conf.checksum_type or 'md5'
		
		express.logger.token 'custom', (req, res)->
			date = new Date
			return "#{req.socket && (req.socket.remoteAddress || (req.socket.socket && req.socket.socket.remoteAddress))} - [#{date.toDateString()} #{date.toLocaleTimeString()}] \"#{req.method} #{req.url}\" #{res.__statusCode or res.statusCode} -"

		# setup express server
		app = express.createServer()
		app.configure ()->
			app.use express.logger {  format: ':custom :response-time ms' } 
			app.use express.static "static"
			app.use app.router 
			app.set 'view engine', 'jade'
		@app = app
					
	start: ()->
		console.log "Starting #{@name} (port :#{@port}, #{@data_root})"
		@app.listen @port		
			
	head: (url, callback)->	
		try 
			@app.head url, callback
		catch err
			console.log err
				
	get: (url, callback)->	
		try 
			@app.get url, callback
		catch err
			console.log err

	put: (url, callback)->
		try 
			@app.put url, callback
		catch err
			console.log err
		
	post: (url, callback)->
		try 
			@app.post url, callback
		catch err
			console.log err

	delete: (url, callback)->	
		try 
			@app.delete url, callback
		catch err
			console.log err
			
	query: (query_statement, query_array, callback)->
		pg.connect @dbconnect, (err, client) ->
			if query_array.length == 0
				q = client.query query_statement, (err, results)->
					q.on 'end', ()->	
						return callback err, null if err?
						return callback null, results if typeof callback is 'function'
			else
				q = client.query query_statement, query_array, (err, results)->
					q.on 'end', ()->	
						return callback err, null if err? 
						return callback null, results if typeof callback is 'function'

module.exports = Server					