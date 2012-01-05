Shock 
===

### To build:

Unix/Macintosh (requires nodejs, postgresql >= 8.4):

    ./bootstrap -d <shock_data_dir> -p <shock_site_port> -N <dbname> -H <dbhost> -U <dbuser> [ -P <dbpasswd> -h <help> ]

Windows:
	
	untested (theoretically possible)

API
---

### Node:

#### id
unique identifier

#### file_name 
file name for attached file if present

#### size
file size for attached file if present

#### checksum
file checksum for attached file if present

#### attributes
arbitrary json

#### acl
access control (in development)

Node example:

	{
	    "id": 6775,
	    "file_name": "h_sapiens_asm.tar.gz",
	    "checksum": "8fd07ad670159c491eed7baefe97c16a",
	    "size": 2819582549,
	    "attributes": {
	        "description": "tar gzip of h_sapiens_asm bowtie indexes",
	        "file_list": [
	            "h_sapiens_asm.1.ebwt",
	            "h_sapiens_asm.2.ebwt",
	            "h_sapiens_asm.3.ebwt",
	            "h_sapiens_asm.4.ebwt",
	            "h_sapiens_asm.rev.1.ebwt",
	            "h_sapiens_asm.rev.2.ebwt"
	        ],
	        "source": "ftp://ftp.cbcb.umd.edu/pub/data/bowtie_indexes/h_sapiens_asm.ebwt.zip"
	    },
	    "acl": {
	        "read": [],
	        "write": [],
	        "delete": []
	    }
	}

### create node:
	
	curl -X POST [ -F "attributes=@<path_to_json>" -F "file=@<path_to_data_file>" ] <shock_url>[:<port>]/node
	
returns:

	{}

### list all nodes:
	
	curl -X GET <shock_url>[:<port>]/node/[?offset=<offset>&count=<count>]
		
returns:

	{"total_nodes":42,"offset":0,"count":4,"nodes":[<node_1>, <node_2>, <node_3>, <node_4>]}
	
### get node:
	
	curl -X GET <shock_url>[:<port>]/node/<nodeid>
	
returns:

	{}
	
### get node file:

	curl -X GET <shock_url>[:<port>]/node/<nodeid>/?download

returns:

	{}	

