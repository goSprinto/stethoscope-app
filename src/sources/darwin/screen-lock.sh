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

exec defaults -currentHost read com.apple.screensaver
extract idleTime\s*=\s*(\d*);
defaultTo -1
save screen.idleDelay
