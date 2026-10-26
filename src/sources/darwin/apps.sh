#!/usr/bin/env kmd
# Enumerates installed applications via system_profiler's JSON output.
#
# Why JSON and not the default text output: in text mode a blank line separates
# an app's name from its properties, so any record delimiter also splits each
# record in half.
#
# Why the '},' delimiter: the JSON is pretty-printed, so records are separated
# by '},\n    {'. kmd collapses runs of whitespace in command arguments
# (args.join(' ') in kmd-script/src/index.js), which rules out any multi-space
# delimiter. '},' is unambiguous here -- no string value in the payload
# contains it.
exec system_profiler -json SPApplicationsDataType
split },
  save _block
  extract "_name"\s*:\s*"([^"]+)"
  save name

  load _block
  extract "version"\s*:\s*"([^"]+)"
  save version

  load _block
  extract "path"\s*:\s*"([^"]+)"
  save path

  # apple | mac_app_store | identified_developer | unknown -- used to separate
  # Apple's own bundles from software the user installed.
  load _block
  extract "obtained_from"\s*:\s*"([^"]+)"
  save obtainedFrom

  remove _block
noEmpty
save apps
