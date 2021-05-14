#/usr/bin/env kmd
exec powershell 'ps | Format-List -Property name'
trim
lines
  extract Name\s+:\s+(.*)
  save appName
noEmpty
save processList
