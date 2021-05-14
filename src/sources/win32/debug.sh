#/usr/bin/env kmd
exec powershell 'Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct'
save output
trim
save antivirusProducts
remove output

pathResolve \\bitlocker-status\\bitlocker-status.exe
save path
template '{path}'
exec
save output
save diskEncryption
remove output
remove path

exec powershell 'Get-WmiObject win32_operatingsystem | select Caption,Version | Format-List'
save output
trim
save os
remove output

exec powershell 'Get-WmiObject win32_desktop | where name -eq (whoami)'
save output
trim
save screensaver
remove output
