# TODO implement when available
#exec ./screenlock-check
pathResolve /mac-screenlock-check/screenlock-check
save path
template '{path}'
exec
save output
remove path

load output
extract Screenlock enabled: (0|1)
save screen.lockEnabled

load output
extract Screenlock starts after: (.*) secs
save screen.lockDelay

remove output

tryExec defaults -currentHost read com.apple.screensaver
extract idleTime\s*=\s*(\d*);
defaultTo -1
save screen.idleDelay
# clear the buffer so tryExec runs pmset rather than the saved value
remove output

tryExec pmset -g
extract displaysleep\s+(\d+)
defaultTo -1
save screen.displaySleep
remove output

# display sleep for every power source (AC, battery, UPS): the active one
# alone can change between scans on a laptop
tryExec pmset -g custom
trim
save screen.displaySleepCustom
