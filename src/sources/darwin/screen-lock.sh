exec ./screenlock-check
save output

extract Screenlock enabled: (0|1)
save screen.lockEnabled

load output
extract Screenlock starts after: (.*) secs
save screen.lockDelay

remove output

exec defaults -currentHost read com.apple.screensaver idleTime
save screen.idleDelay
