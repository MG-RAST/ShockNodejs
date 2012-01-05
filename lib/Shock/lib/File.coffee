##########################################################################
#                   Shock - OSDF reference implementation                               
# Authors:  
#     Jared Wilkening (jared at mcs.anl.gov)
#     Narayan Desai   (desai at mcs.anl.gov)
#     Folker Meyer    (folker at anl.gov)
##########################################################################

util    = require 'util'
fs      = require 'fs'
crypto  = require 'crypto'
exec    = require('child_process').exec
mkdirp  = require 'mkdirp'
emitter = require('events').EventEmitter

##########################################################################
# Shock File class
##########################################################################

class File
	constructor: (server)->	
		@server = server
		@checksum_type = server.checksum_type or "md5"
		@data_root = server.data_root
		
	create: (path, checksum, cb)->		
		if typeof cb != 'function'
			if typeof checksum == 'function'
				cb = checksum
				checksum = null
			else
				throw new Error "File.create can not be called without a callback"

		if not checksum?
			checksumFile path, @checksum_type, (err, checksum)=>
				return cb err, null if err?
				this.reserve checksum, (reserved)=>
					if not reserved
						fs.unlink path
						return cb null, checksum 
					else
						mkdirp "#{@data_root}/#{checksumPath checksum}", '0755', (err)=>
							return cb err, null if err?
							exec "mv #{path} #{@data_root}/#{checksumPath checksum}/#{checksum}", (error, stdout, stderr)=>						
								return cb stderr, null if err?
								this.update checksum, (err)->
									return cb err, null if err?
									return cb null, checksum
		else
			this.reserve checksum, (reserved)=>
				if not reserved
					fs.unlink path
					return cb null, checksum 
				else
					mkdirp "#{@data_root}/#{checksumPath checksum}", '0755', (err)=>
						return cb err, null if err?
						exec "mv #{path} #{@data_root}/#{checksumPath checksum}/#{checksum}", (error, stdout, stderr)=>						
							return cb stderr, null if err?
							this.update checksum, (err)->
								return cb err, null if err?
								return cb null, checksum

	reserve: (checksum, cb)->
		#begin; lock table files in row exclusive mode; savepoint my_savepoint; insert into files (checksum) values ('#{checksum}');
		#@server.query "rollback to savepoint my_savepoint; commit;", [], (err, results)=>
		@server.query "insert into files (checksum) values ($1)", [checksum], (err, results)=>			
			return cb false if err?					
			return cb true 
			
	update: (checksum, cb)->
		path = this.path checksum
		fs.stat path, (err, stats)=>
			return cb err if err?
			fileType path, (err, type)=>
				return cb err if err?
				@server.query "update files set (checksum_type, file_format, file_type, file_size) = ($2, $3, $4, $5) where checksum = $1", [checksum, @checksum_type, null, type, stats.size], (err, results)=>
					return cb err if err?
					return cb null
	
	path: (checksum)->
		return "#{@data_root}/#{checksumPath checksum}/#{checksum}"
	
	exists: (checksum)->
		@server.query "select count(checksum) from files where checksum = $1", [checksum], (err, results)=>
			return cb err, null if err?
			return cb true if results? and results.rows.length > 0
			return cb false
			
	delete: (checksum, cb)->
		return 
		
	attach: (checksum, file_name, node_id, cb)->
		@server.query "select * from files where checksum = $1", [checksum], (err, results)=>
			return cb err, null if err?
			return cb err, null unless results.rows[0]?			
			return setTimeout (()=> this.attach checksum, file_name, node_id, cb), 50 unless results.rows[0].file_size?			  
			@server.query "update nodes set (file_name, size, checksum) = ($1, $2, $3) where id = $4", [file_name, results.rows[0].file_size, checksum, node_id], (err, results)=>
				return cb err, null if err?
				return cb null, true if results?
				return cb null, false

	detach: (checksum, node_id)->
		@server.query "update nodes set (file_name, size, checksum) = ($1, $2) where id = $3 and checksum = $4", [null, null, null, node_id, checksum], (err, results)=>
			return cb err, null if err?
			return cb null, true if results?
			return cb null, false
	
	get: (checksum)->
		path = this.path checksum
		return new wholeFileRead(path)

##########################################################################
# exports
##########################################################################

module.exports = File

##########################################################################
# helper functions
##########################################################################

wholeFileRead = (path)->
	emitter.call this
	fs.createReadStream(path).addListener('data', (chunk)->
		this.emit 'chunk', chunk
	).addListener('end', ()-> 
		this.emit 'done'
	)
util.inherits wholeFileRead, emitter

fileType = (path, cb)->
	exec "file #{path}", (error, stdout, stderr)=>
		return cb stderr, null if err?
		return cb null, stdout.split(": ")[1].replace /[\s\r\n]+$/, ''
					
checksumPath = (checksum)->
	return "#{checksum.substring 0, 2}/#{checksum.substring 2, 4}/#{checksum.substring 4, 6}"
			
checksumFile = (path, type, cb)->
	sum = crypto.createHash type
	f = fs.ReadStream path
	f.on 'data', (d)->
		sum.update d
	f.on 'error', (err)->
		console.log "checksumFile - error"
		return cb err, null
	f.on 'end', ()->
		return cb null, sum.digest 'hex'