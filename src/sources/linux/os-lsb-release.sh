#!/usr/bin/env kmd
exec lsb_release -a
save output
extract \nRelease:*([\d\.]+)[^\n]*\n
save system.version

remove output