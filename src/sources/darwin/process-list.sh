#!/usr/bin/env kmd
# -c : ensure the full command name is printed.
# -o comm= : Only the command name is printed and header is ommited
exec ps axc -o comm=
trim
lines
  save appName
noEmpty
save processList
