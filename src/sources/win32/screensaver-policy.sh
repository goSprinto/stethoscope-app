tryExec powershell 'Get-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Control Panel\Desktop\" | Format-List'
trim
save output1

extract ScreenSaveActive\s+:\s+([0-9]*)
defaultTo -1
save screenSaveActive

load output1
extract ScreenSaverIsSecure\s+:\s+([0-9]*)
defaultTo -1
save screenSaverIsSecure

load output1
extract ScreenSaveTimeout\s+:\s+([0-9]*)
defaultTo -1
save screenSaveTimeout

remove output1