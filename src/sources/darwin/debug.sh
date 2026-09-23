#!/usr/bin/env kmd
exec system_profiler SPHardwareDataType
save line
save hardware
remove line

exec /usr/bin/fdesetup status
save output
save fdesetupOutput
remove output

exec sw_vers
save output
save os
remove output

# raw `sysadminctl -screenLock status` output; it writes to stderr, which kmd's
# exec does not capture, hence the sh -c wrapper
tryExec sh -c 'sysadminctl -screenLock status 2>&1'
save output
save screenlock
remove output

tryExec defaults -currentHost read com.apple.screensaver
save output
save screensaver
remove output

exec ps axc -o comm=
trim
save output
save processes
remove output
