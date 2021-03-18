#/usr/bin/env kmd
exec powershell 'wmic /Node:localhost /Namespace:\\\\root\\SecurityCenter2 Path AntiVirusProduct Get * /value'
trim
split \n\n
  save line
  extract displayName=(.*)
  save name

  load line
  extract productState=(.*)
  save state

  remove line
noEmpty
save antivirusProducts
