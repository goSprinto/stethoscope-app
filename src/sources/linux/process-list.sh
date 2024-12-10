#!/usr/bin/env kmd
exec ps axh -o comm 
trim
lines
  save appName
noEmpty
save processList
