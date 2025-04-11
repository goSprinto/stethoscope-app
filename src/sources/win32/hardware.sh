#!/usr/bin/env kmd
exec powershell 'Get-CimInstance Win32_ComputerSystemProduct | Select-Object UUID, Vendor, Version | Format-List'
trim
save out

extract UUID\s*:\s*([\w\d-]+)
save system.uuid

load out
extract Vendor\s*:\s*([^\n]+)
save system.hardwareVendor

load out
extract Version\s*:\s*([^\n]+)
save system.hardwareVersion

remove out

tryExec reg query 'HKLM\\SOFTWARE\\MICROSOFT\\CRYPTOGRAPHY'
save out
extract MachineGuid\s+REG_SZ\s+([\w\d-]+)
save system.machineGuid

remove out

exec powershell 'Get-CimInstance win32_operatingsystem | select SerialNumber | Format-List'
extract SerialNumber\s+:\s+([\d\-A-Z]+)
save system.serialNumber
