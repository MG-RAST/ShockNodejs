#!/bin/sh

# npm will install the following libs
global_libs="node-dev coffee-script express"
local_libs="jade pg formidable mkdirp"

# subroutines 
echog () { echo "\033[0;32m"$1"\033[0m"; }
echoy () { echo "\033[1;33m"$1"\033[0m"; }
echor () { echo "\033[0;31m"$1"\033[0m"; }

cmdpresent () {
	if [ -z  `which $1` ]; then 
		echo $1" not found"
		echor "[error] please install "$1" or add to path to continue"
		exit 1
	else 
		echo $1"...\tfound"
	fi	
}

# options
dataroot=""
port=""
dbname=""
dbhost=""
dbuser=""
dbpasswd=""
help=0
USAGE="Usage: "`basename $0`" -d <shock_data_dir> -p <shock_site_port> -N <dbname> -H <dbhost> -U <dbuser> [ -P <dbpasswd> -h <help> ]"

# please note the following section is magic. change at your own risk.
args=$(getopt "d:p:N:H:U:P:h --" $* 2>/dev/null)
if [ $? -ne 0 ]; then 
	echo ${USAGE}
	echor "[error] illegal option or missing value"
	exit 1
fi
set -- $args
while [ $# -gt 0 ]
do
    case "$1" in
		-d) dataroot=$2; shift 2 ;;
		-p) port=$2; shift 2 ;;
		-N) dbname=$2; shift 2 ;;
		-H) dbhost=$2; shift 2 ;;
		-U) dbuser=$2; shift 2 ;;
		-P) dbpasswd=$2; shift 2;;
		-h) help=1; shift ;;
		--) shift; break;;
		-*) echo "$0: error - unrecognized option $1" 1>&2; exit 1;;
		*) break;;
    esac
done
# end magic

if [ $help -eq 1 ]; then 
	echo ${USAGE}
	exit 0;
fi

echog "[info] Starting Shock bootstrap"
echo "dataroot: "${dataroot}
echo "port: "${port}
echo "dbname: "${dbname}
echo "dbuser: "${dbuser}
echo "dbpasswd: "${dbpasswd}

if [ -z ${dataroot} ] || [ -z ${port} ] || [ -z ${dbname} ] || [ -z ${dbuser} ]; then 
	echor "[error] only dbpasswd is optional"
	echo ${USAGE}
	exit 1
fi

echog "[info] checking for prerequisites"
cmdpresent node
cmdpresent npm
cmdpresent psql

echog "[info] Installing required nodejs libraries via npm"
if [ `whoami` != 'root' ]; then echoy "[warning] depending on your system configuration npm may not succeed as non-root user"; fi

# global install libs
npm install -fg ${global_libs}
if [ $? -ne 0 ]; then echor "[error] npm failed to install required libraries. Check warning messages and npm log."; exit 1; fi

# local install libs
npm link -f ${local_libs} 
if [ $? -ne 0 ]; then echor "[error] npm failed to install required libraries. Check warning messages and npm log."; exit 1; fi

echog "[info] creating database tables"
set PGPASSWORD=${dbpasswd}
psql -U ${dbuser} -h ${dbhost} ${dbname} < sql/backend.sql
if [ $? -ne 0 ]; then echor "[error] creating database tables failed"; exit 1; fi

echog "[info] creating Shock server conf file at conf/server.conf"
echo '{
   "_about"    : "Shock - node json configuration file",
   "name"      : "Shock",
   "port"      : '${port}',
   "data_root" : "'${dataroot}'",
   "dbhost"    : "'${dbhost}'",
   "dbname"    : "'${dbname}'",
   "dbuser"    : "'${dbuser}'",
   "dbpasswd"  : "'${dbpasswd}'"
}' > conf/server.conf
cat conf/server.conf

echog "[info] compiling coffeescript to javascript"
if [ -z  `which coffee` ]; then 
	echo "coffee not found"
	echor "[error] something when wrong in the npm installation of coffeescript"
	exit 1
fi
coffee -c `find . | grep coffee | grep -v node_modules`
if [ $? -ne 0 ]; then echor "[error] coffeescript failed to compile"; exit 1; fi

# done
echog "[info] Shock successfully installed. Run 'node shock' to start"