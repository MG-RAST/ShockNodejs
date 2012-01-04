##########################################################################
#                   Shock - OSDF reference implementation                               
# Authors:  
#     Jared Wilkening (jared at mcs.anl.gov)
#     Narayan Desai   (desai at mcs.anl.gov)
#     Folker Meyer    (folker at anl.gov)
##########################################################################

formidable = require 'formidable'
sys        = require 'sys'
fs         = require 'fs'
path       = require 'path' 
http       = require 'http' 
util       = require 'util'
exec       = require('child_process').exec

##########################################################################
# Handler class
##########################################################################

class Routes
	constructor: (server, shock)->
		@server = server
		@shock  = shock
	
	index: (req, res)->
		columns = ['id', 'file_name', 'checksum', 'size', 'attributes', 'acls']
		res.render 'index', {locals: { pageTitle: "Shock - main", columns: columns}} if isBrowser req		
		
	browse: (req, res)->
		sEcho = req.query.sEcho or 0
		limit = req.query.iDisplayLength or 10
		offset = req.query.iDisplayStart or 0
		@shock.nodes.query {}, limit, offset, (err, nodes)=>
			return errorRes res, req, err, "db connection issue" if err?			
			rows = []
			for row in nodes
				rows.push [row.id, row.file_name, row.checksum, row.size, JSON.stringify(row.attributes), JSON.stringify(row.acl)]
			@shock.nodes.count (err, count)=>
				return errorRes res, req, err, "db connection issue" if err?
				clientRes res, { "sEcho": sEcho, "iTotalRecords": count, "iTotalDisplayRecords": count, aaData : rows }

	get: (req, res)->
		# /?download - complete file download
		# /?download&index=$index&part=$part - file part download
		# /?list&indexes - index parts list
		# /?list&index=$index - index parts list
		if req.query.list? 
			if req.query.index?
				console.log "route - index parts list"
				return this.single req, res
			else if req.query.indexes?
				console.log "route - available index list"
				return this.single req, res
			else				
				return this.single req, res
		else if req.query.download?
			if req.query.index? and req.query.part?
				console.log "route - download index part #{req.query.part}"
				return this.single req, res				
			else if req.query.part?
				console.log "route - download default index part #{req.query.part}"
				return this.single req, res				
			else
				console.log "route - download full file"
				return this.complete req, res				
		else
			return this.single req, res
	
	put: (req, res)->
		# / multipart-form containing: file (will not replace), attributes (json file: will replace)
		# /?attribute1=value&attribute2=value (will replace / insert)
		# /?attributes - attributes (json file: will replace)
		qlen = 0
		for k in req.query 
			qlen++
		return this.update req, res if qlen is 0
		return this.get req, res
		
	single: (req, res)->
		id = req.params.id
		@shock.nodes.get id, (err, node)=>
			return errorRes res, req, err, err if err?
			res.render 'object', {locals: { pageTitle: "Shock - main", id: id, object: JSON.stringify(node, null, 4) }} if isBrowser req
			clientRes res, node if not isBrowser req

	del: (req, res)->
		id = req.params.id
		@shock.nodes.delete id, (err)->
			return errorRes res, req, err, "db connection issue" if err?
			clientRes res, {"status" : "success"}
		
	modify: (req, res)=>
		return res.render 'index', {locals: { pageTitle: "Shock - main" }} if isBrowser req
		return clientRes res, {} if not isBrowser req	

	complete: (req, res)->
		id = req.params.id
		@shock.nodes.checksum id, (err, checksum)=>
			return errorRes res, req, err, "db connection issue" if err?
			if checksum?
				res.writeHead 200,
					'content-type': 'application/octet-stream',
					'content-disposition': ":attachment;filename=#{id}"
				rs = @shock.file.get checksum
				rs.addListener 'chunk', (chunk)->
					res.write chunk
				rs.addListener 'done', ()->
					res.end()
			else
				return errorRes res, req, err, "id #{id} has no associated file"

	chunk: (req, res)->
		return res.render 'index', {locals: { pageTitle: "Shock - main" }} if isBrowser req
		return clientRes res, {} if not isBrowser req
	
	update: (req, res)=>
		id = req.params.id
		form = new formidable.IncomingForm()
		form.uploadDir = @server.upload_dir
		#form.checksum  = @server.checksum_type
		fields = {}
		files = {}
		form.on "aborted", ()=>
			return console.log "Connection aborted by user"
		form.on "error", (err)->
			return errorRes res, req, err, "error: invalid multipart/form data"
		form.on "field", (field, value)->
			fields[field] = value 
		form.on "file", (field, file)->
			files[field] = file
		form.on "end", ()=>
			attributes = {}
			if files['attributes']?
				attrFile = ''
				try
					attrFile = fs.readFileSync files['attributes'].path, 'utf8'
				catch err
					return errorRes res, req, err, "error: attributes invalid json file"
				try						
					attributes = JSON.parse attrFile
				catch err
					console.log "-------> file start - #{files['attributes'].path}"
					console.log attrFile
					console.log "-------> file end - #{files['attributes'].path}"
					return errorRes res, req, err, "error: attributes invalid json file"
				fs.unlink files['attributes'].path
			@shock.nodes.update id, attributes, (err, updated)=>
				return errorRes res, req, err, err if err?
				return res.redirect "/node/#{id}" unless files['file']?
				@shock.file.create files['file'].path, files['file'].md5, (err, checksum)=>		
					return errorRes res, req, err, "internal error" if err? or not checksum?
					@shock.file.attach checksum, files['file'].name, id, (err, attached)=>
						return errorRes res, req, err, "internal error" if err? 
						return res.redirect "/node/#{id}"
		form.parse req
												
	register: (req, res)=>
		if req.method == "GET"
			res.render 'register', {locals: { pageTitle: "Shock - Register"}}
		else
			form = new formidable.IncomingForm()
			form.uploadDir = @server.upload_dir
			#form.checksum  = @server.checksum_type
			fields = {}
			files = {}
			form.on "aborted", ()=>
				return console.log "Connection aborted by user"
			form.on "error", (err)->
				return errorRes res, req, err, "error: invalid multipart/form data"
			form.on "field", (field, value)->
				fields[field] = value 
			form.on "file", (field, file)->
				files[field] = file
			form.on "end", ()=>
				attributes = {}
				if files['attributes']?
					attrFile = ''
					try
						attrFile = fs.readFileSync files['attributes'].path, 'utf8'
					catch err
						return errorRes res, req, err, "error: attributes invalid json file"
					try						
						attributes = JSON.parse attrFile
					catch err
						console.log "-------> file start - #{files['attributes'].path}"
						console.log attrFile
						console.log "-------> file end - #{files['attributes'].path}"
						return errorRes res, req, err, "error: attributes invalid json file"
					fs.unlink files['attributes'].path
				@shock.nodes.create attributes, (err, node)=>
					return errorRes res, req, err, "db connection issue" if err?
					return res.redirect "/node/#{node.id}" unless files['file']?
					@shock.file.create files['file'].path, files['file'].md5, (err, checksum)=>		
						return errorRes res, req, err, "internal error" if err? or not checksum?
						@shock.file.attach checksum, files['file'].name, node.id, (err, attached)=>
							return errorRes res, req, err, "internal error" if err? 
							return res.redirect "/node/#{node.id}"
			form.parse req
						
	query: (req, res)=>
		return res.render 'index', {locals: { pageTitle: "Shock - main" }} if isBrowser req
		return clientRes res, {} if not isBrowser req

##########################################################################
# exports
##########################################################################

module.exports = Routes
			
##########################################################################
# helper functions
##########################################################################
isBrowser = (req)->
	return /(Mozilla|AppleWebKit|Chrome|Gecko|Safari)/.test req.headers['user-agent'] 

clientRes = (res, response, httpcode)->
	httpcode or= 200
	res.writeHead httpcode, {'content-type': 'application/json'}
	res.end JSON.stringify response

errorRes = (res, req, err, message)->
	if err? and err.stack?
		console.log err.stack 
	else if err?
		console.log err 
	res.render 'index', {locals: { pageTitle: "Shock - main", message: message }} if isBrowser req
	clientRes res, { "message" : message, "status" : "Error" } if not isBrowser req
	
uncouchdb = (doc)->
	tmp = {}
	for k, v of doc
		tmp[k.replace(/^_/, "")]=v
	return tmp	

recouchdb = (doc)->
	tmp = {}
	for k, v of doc
		if k in ['id', 'rev']
			tmp["_#{k}"]=v
		else
			tmp[k.replace(/^_/, "")]=v
	return tmp
	