Shock 
===

### To build:

Unix/Macintosh (requires nodejs, postgresql >= 8.4):

    ./bootstrap -d <shock_data_dir> -p <shock_site_port> -N <dbname> -H <dbhost> -U <dbuser> [ -P <dbpasswd> -h <help> ]

Windows:
	
	untested (theoretically possible)

API
---

### create node:

curl call:
	
	curl -X POST [ -F "attributes=@<path_to_json>" -F "file=@<path_to_data_file>" ] <shock_url>[:<port>]/node
	
returns:

	{}

### list all nodes:
	
curl call:
	
	curl -X GET <shock_url>[:<port>]/node
	
returns:

	[[]]
	
### get node:

curl call:
	
	curl -X GET <shock_url>[:<port>]/node/<nodeid>
	
returns:

	{}
	
### get node file:

curl call:

	curl -X GET <shock_url>[:<port>]/node/<nodeid>/?download

returns:

	{}	

