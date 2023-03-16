#!/usr/bin/env kmd
exec cat /etc/os-release
save output
extract NAME="(.*)"\n
save system.platform

load output
extract \nID="*(.*)"*\n
save system.distroId

load output
extract \nID_LIKE="*(.*)"*\n
save system.distroIdLike

load output
extract \nVERSION="*([\d\.]+)[^\n]*\n
save system.version

remove output

exec uname -r
save output
save system.build
remove output

exec lsb_release -a
save output
extract \nRelease:\s*([\d\.]+)[^\n]*\n
save system.lsb_version
remove output