#/usr/bin/env kmd
# Name               : LAPTOP-345F8N6C\Jaya Jha
# ScreenSaverActive  : True
# ScreenSaverSecure  : True
# ScreenSaverTimeout : 1200
# SettingID          :

tryExec powershell 'Get-CimInstance win32_desktop | where name -eq (whoami) | Format-List'
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

remove output