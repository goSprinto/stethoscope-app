#!/usr/bin/env kmd
 exec lsb-release -a
 extract \nDISTRIB_RELEASE=\s*([\d\.]+)[^\n]*\n
 save system.lsb_version
 
