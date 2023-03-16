#!/usr/bin/env kmd
exec lsb_release -a
extract \nRelease=\s*([\d\.]+)[^\n]*\n
save system.lsb_version
