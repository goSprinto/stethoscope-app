# Screen lock state comes from `sysadminctl -screenLock status`, the supported
# macOS interface. The old `defaults -currentHost read com.apple.screensaver
# askForPassword / askForPasswordDelay` keys were removed by Apple (reading them
# now reports "does not exist"), which is why this check previously shipped a
# bundled helper binary.
#
# sysadminctl writes to stderr and kmd's exec only captures stdout, hence
# `sh -c ... 2>&1`. The sed normalises the three documented outputs
#   "screenLock is off"             -> enabled:0 delay:-1
#   "screenLock delay is immediate" -> enabled:1 delay:0
#   "screenLock delay is N seconds" -> enabled:1 delay:N
# so the values saved below stay identical to what the helper binary produced.
# Anything unrecognised (e.g. "Unknown state for screenLock") passes through, the
# extracts miss, and the defaults report "not locked" -- the safe direction for a
# compliance check.
tryExec sh -c 'sysadminctl -screenLock status 2>&1 | sed -E \"s/.*screenLock is off.*/enabled:0 delay:-1/; s/.*screenLock delay is immediate.*/enabled:1 delay:0/; s/.*screenLock delay is ([0-9]+) seconds.*/enabled:1 delay:\\1/\"'
save output

load output
extract enabled:(\d+)
defaultTo 0
save screen.lockEnabled

load output
extract delay:(-?\d+)
defaultTo -1
save screen.lockDelay

remove output

tryExec defaults -currentHost read com.apple.screensaver
extract idleTime\s*=\s*(\d*);
defaultTo -1
save screen.idleDelay
