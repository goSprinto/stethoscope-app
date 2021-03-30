#!/usr/bin/env kmd
exec ps axc -o comm=
trim
lines
  save appName
noEmpty
save processList
