#!/bin/sh

ACTION=$1

URL="http://localhost:8888"
#URL="http://shock.mcs.anl.gov" 

if [ "$ACTION" = "register" ]
then
	curl -F "name=$2" -F "parts=$3" -F "submit=Register" ${URL}/register
elif [ "$ACTION" = "get" ]
then
	curl ${URL}/get/$2
elif [ "$ACTION" = "put" ]
then
	curl -F "upload=@$4" -F "id=$2" -F "part=$3" ${URL}/put
elif [ "$ACTION" = "del" ]
then
	curl ${URL}/del/$2
else
    echo "[usage] $0 [register|get|put|del]"
	echo "options:"
	echo "   register <name> <parts #>"
	echo "   get <id>"
	echo "   put <id> <part #> <file>"
fi
