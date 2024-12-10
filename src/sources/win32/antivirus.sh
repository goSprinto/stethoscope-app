#/usr/bin/env kmd
exec powershell 'Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct'
trim
split \r\n\r\n
  save line
  extract displayName\s*:\s*([^\r\n]+)
  save name

  load line
  extract productState\s*:\s*([^\r\n]+)
  save productState

  remove line
noEmpty
save antivirusProducts
