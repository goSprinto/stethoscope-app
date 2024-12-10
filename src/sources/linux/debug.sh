#!/usr/bin/env kmd
exec cat /etc/machine-id
save output
trim
save systemUUID
remove output

exec cat /etc/os-release
save output
save osRelease
remove output

exec uname -r
save output
save systemBuild
remove output

exec lsblk -f
save output
trim
save disks
remove output

exec gsettings list-recursively org.gnome.desktop.session
save output
trim
save desktopSession
remove output

exec gsettings list-recursively org.gnome.desktop.screensaver
save output
trim
save desktopScreensaver
remove output

exec ps axh -o comm 
save output
trim
save processes
remove output
