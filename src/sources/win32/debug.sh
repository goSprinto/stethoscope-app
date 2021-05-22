#/usr/bin/env kmd
exec powershell 'Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct'
save output
trim
save debug.avProducts
remove output

pathResolve \\bitlocker-status\\bitlocker-status.exe
save path
template '{path}'
exec
save output
save debug.bitlocker
remove output
remove path

exec powershell 'Get-WmiObject win32_operatingsystem | select Caption,Version | Format-List'
save output
trim
save debug.os
remove output

exec powershell 'Get-WmiObject win32_desktop | where name -eq (whoami)'
save output
trim
save debug.screensaver
remove output

pathResolve \\verastatus\\VeraStatus.exe
save verastatus_path
template '{verastatus_path}'
tryExec
save output
save debug.verastatus
remove verastatus_path
remove output
