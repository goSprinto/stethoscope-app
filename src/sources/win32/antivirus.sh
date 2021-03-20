#/usr/bin/env kmd
exec powershell 'Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct'
trim
split \n\n
  save line
  extract displayName\s*:\s*([^\n]+)
  save name

  load line
  extract productState\s*:\s*([^\n]+)
  save productState

  remove line
noEmpty
save antivirusProducts
