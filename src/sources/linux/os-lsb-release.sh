#!/usr/bin/env kmd
 exec lsb_release -a
 extract \nDISTRIB_RELEASE=\s*([\d\.]+)[^\n]*\n
 save system.lsb_version