#/usr/bin/env kmd
# Name               : LAPTOP-345F8N6C\Jaya Jha
# ScreenSaverActive  : True
# ScreenSaverSecure  : True
# ScreenSaverTimeout : 1200
# SettingID          :

exec powershell 'Get-CimInstance win32_desktop | where name -eq (whoami) | Format-List'
trim
save output

extract ScreenSaverActive\s+:\s+(.*)
save screensaverEnabled

load output
extract ScreenSaverSecure\s+:\s+(.*)
save screenlockEnabled

load output
extract ScreenSaverTimeout\s+:\s+([0-9]*)
defaultTo -1
save screenlockDelay

exec powershell 'Get-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Control Panel\Desktop\" | Format-List'
trim
save output

extract ScreenSaveActive\s+:\s+([0-9]*)
defaultTo -1
save screenSaveActive

load output
extract ScreenSaverIsSecure\s+:\s+([0-9]*)
defaultTo -1
save screenSaverIsSecure

load output
extract ScreenSaveTimeout\s+:\s+([0-9]*)
defaultTo -1
save screenSaveTimeout

remove output