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

pathResolve /mac-screenlock-check/screenlock-check
save path
template '{path}'
exec
save output
save screenlock
remove path
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
