##########################################################################
#                   Shock - OSDF reference implementation                               
# Authors:  
#     Jared Wilkening (jared at mcs.anl.gov)
#     Narayan Desai   (desai at mcs.anl.gov)
#     Folker Meyer    (folker at anl.gov)
##########################################################################

util = require 'util'
fs   = require 'fs'
exec = require('child_process').exec

##########################################################################
# Shock Nodes class
##########################################################################

class Nodes
	constructor: (server)->
		@server = server

	# node.new(attributes, cb)
	create: (attributes, cb)->
		if typeof cb != 'function'
			throw new Error "Nodes.create can not be called without a callback"

		@server.query "insert into nodes (id) values (default) returning id", [], (err, results)=>
			return cb err, null if err?		
			if results.rows? and results.rows[0].id?
				id = results.rows[0].id
				values = []
				attrRows = deconstruct attributes
				if attrRows.length > 0 
					insertRows = []
					for row in attrRows
						index		= if row[1]? then "'#{row[1]}'" else 'NULL'
						container	= if row[2]? then "'#{row[2]}'" else 'NULL'
						tag 		= if row[3]? then "'#{row[3]}'" else 'NULL'
						value		= if row[4]? then "'#{row[4]}'" else 'NULL'						
						insertRows.push "(#{id}, #{row[0]}, #{index}, #{container}, #{tag}, #{value})"
					@server.query "insert into attributes (node_id, level, index, container, tag, value) values #{insertRows.join(', ')}", [], (err, results)=>
						console.log err if err?
						return this.get id, cb 
				else
					return this.get id, cb 
			else	
				return cb "Could not create node, unknown error", null
				
			
	# node.update(id, attributes, cb)
	# update 
	# insert attributes on fail update
	update: (id, attributes, cb)->
		if typeof cb != 'function'
			throw new Error "Nodes.create can not be called without a callback"

		@server.query "select id from nodes where id = $1", [id], (err, results)=>
			return cb err, false if err?		
			if results.rows? and results.rows[0]?
				return cb null, true 
			else	
				return cb "node not found", false
		
	# node.init(id, cb)
	get: (id, cb)->
		if typeof cb is not 'function'
			throw "Nodes.get can not be called without a callback"
		@server.query "select * from nodes where id = $1", [id], (err, results)=>
			return cb err, null if err?		
			return cb "node not found", null if not results.rows? or results.rows.length == 0
			node = results.rows[0]
			@server.query "select level, index, container, tag, value from attributes where node_id = $1 order by id asc", [id], (err, results)=>
				attrRows = []
				for row in results.rows
					attrRows.push [row.level, row.index, row.container, row.tag, row.value]
				attributes = reconstruct attrRows	
				node.attributes = attributes
				@server.query "select S.name as scope_name, A.read, A.write, A.del from (select * from acls where node_id = $1) as A join (select * from scopes) as S on A.scope_id = S.id", [id], (err, results)=>
					acl = 
						"read"   : []
						"write"  : []
						"delete" : []
					for row in results.rows
						acl.read.push row.scope_name if row.read 
						acl.write.push row.scope_name if row.write 
						acl.delete.push row.scope_name if row.del
					node.acl = acl 			
					return cb null, node

	delete: (id, cb)->
		@server.query "delete from attributes where node_id = $1", [id], (err, results)=>
			return cb err if err?
			@server.query "delete from indexes where node_id = $1", [id], (err, results)=>
				return cb err if err?
				@server.query "delete from acls where node_id = $1", [id], (err, results)=>
					return cb err if err?
					@server.query "delete from nodes where id = $1", [id], (err, results)=>
							return cb err if err?
							return cb null
						
	# node.query({}, limit, offset, cb) or node.query({}, cb)
	# { tag : value }, 100, 50, cb
	query: (attributes, limit, offset, cb)->
		limit_offset = ""
		if limit? and limit > 0 and offset? and offset >= 0
			limit_offset = "limit #{limit} offset #{offset}"		
		@server.query "select * from nodes order by id #{limit_offset}", [], (err, results)=>
			return cb err, null if err?
			if results.rows? and results.rows.length > 0
				nodes = {}
				idSet = []
				for r in results.rows
					idSet.push r.id
					nodes[r.id] = r
					nodes[r.id]['acl'] = {}
				@server.query "select node_id, level, index, container, tag, value from attributes where node_id in (#{idSet.join ', '})", [], (err, results)=>	
					return cb err, null if err?
					if results.rows? and results.rows.length > 0
						nodeAttrRows = {}
						for row in results.rows
							nodeAttrRows[row.node_id] = [] if not nodeAttrRows[row.node_id]?
							nodeAttrRows[row.node_id].push [row.level, row.index, row.container, row.tag, row.value]									
						for id, attrRows of nodeAttrRows
							nodes[id]["attributes"] = reconstruct attrRows
					for n of nodes
						nodes[n]['attributes'] = {} unless nodes[n]['attributes']?
					@server.query "select A.node_id, S.name as scope_name, A.read, A.write, A.del from (select * from acls where node_id in (#{idSet.join ', '})) as A join (select * from scopes) as S on A.scope_id = S.id", [], (err, results)=>
						return cb err, null if err?
						acls = {}
						for row in results.rows
							acls[row.node_id] = {'read' : [], 'write' : [], 'delete' : []} if not acls[row.node_id]?
							acls[row.node_id]['read'].push row.scope_name if row.read
							acls[row.node_id]['write'].push row.scope_name if row.write
							acls[row.node_id]['delete'].push row.scope_name if row.del
						for n of nodes
							if acls[n]?
								nodes[n]['acl'] = acls[n]
							else
								nodes[n]['acl'] = {'read' : [], 'write' : [], 'delete' : []} 
						queryResults = []
						for id, node of nodes 
							queryResults.push node
						return cb null, queryResults


	count: (cb)->
		@server.query "select count(id) from nodes", [], (err, results)=>
			return cb err, null if err?
			if results.rows? and results.rows.length > 0
				return cb null, results.rows[0].count
			else 
				return cb null, 0
	
	dir: (id)->
		return "#{@server.data_root}/#{dirHash id}/#{id}"

	checksum: (id, cb)->
		@server.query "select id, checksum from nodes where id = $1", [id], (err, results)=>
			return cb err, null if err?
			if results.rows? and results.rows.length > 0
				return cb null, results.rows[0].checksum
			else 
				return cb null, null
			
##########################################################################
# exports
##########################################################################

module.exports = Nodes

##########################################################################
# helper functions
##########################################################################
createNodeDir = (root, id, cb)->
	fs.stat "#{root}/#{dirHash id}", (err, stats)->
		if stats?
			path = "#{root}/#{dirHash id}/#{id}"
			rmdirRecursive path, (err)->
				return cb err if err?
				fs.mkdir path, (err)->
					return cb err if err? 
					return cb null
		else
			fs.mkdir "#{root}/#{dirHash id}", (err)->
				return cb err if err?
				fs.mkdir "#{root}/#{dirHash id}/#{id}", (err)->
					return cb err if err? 
					return cb null

deleteNodeDir = (root, id, cb)->
	rmdirRecursive "#{root}/#{dirHash id}/#{id}", (err)->
		return cb err if err?	
		return cb null

dirHash = (id)->
	hash = "#{id}".substring ("#{id}".length - 2)
	return "0#{hash}" if hash.length == 1
	return hash
	

rmdirRecursive = (path, cb)->
	fs.stat path, (err, stats)->
		if stats?
			exec "rm -r #{path}", (err, stdout, stderr)->
				return cb stderr if err?
				return cb null
		else 
			return cb null
			
getSet = (nodes, set, results, cb)->
	if set.length > 0
		id = set.shift()
		nodes.get id, (err, node)->
			return cb err, results if err?
			results.push node
			getSet nodes, set, results, cb
	else
		return cb null, results

###
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
###
 
deconstruct = (json)->
	rows = []
	return "invalid object" if typeOf(json) is not 'object'
	level = 0		
	for key, value of json		
		rows.insert 0, null, key, value		
	return rows

reconstruct = (rows)->
	json = {}
	levels = 
		'0' : json
	while rows.length > 0
		row = rows.shift()
		if levels[row[0]]?
			if row[2]? 
				container = if row[2] is 'a' then [] else {}
				if row[1]?
					levels[row[0]][row[1]] = container
					levels[row[4]] = levels[row[0]][row[1]]			
				else 
					levels[row[0]][row[3]] = container
					levels[row[4]] = levels[row[0]][row[3]]
			else				
				if row[1]?
					levels[row[0]][row[1]] = row[4] 
				else
					levels[row[0]][row[3]] = row[4] 
		else
			rows.push row
	return json

levelSort = (a,b)->
	return a[0] - b[0]

Array.prototype.insert = (level, index, key, value)->
	switch typeOf(value)
		when 'array'
			tmpindex = 0
			nextLevel = this.maxLevel()+1			
			this.push [level, index, 'a', key, nextLevel] 
			for i in value
				this.insert nextLevel, tmpindex, key, i
				tmpindex++
		when 'object'
			nextLevel = this.maxLevel()+1 		
			this.push [level, index, 'm', key, nextLevel]
			for k,v of value
				this.insert nextLevel, null, k, v
		else
			this.push [level, index, null, key, value]

Array.prototype.maxLevel = ()->
	max = 0
	for r in this
		max = r[0] if r[0] > max
		if r[2] in ['m', 'a']
			max = r[4] if r[4] > max
	return max
	
typeOf = (obj)->
	if typeof obj is 'object'
		return 'array' if obj.push
		return 'object'
	else
		return typeof obj
