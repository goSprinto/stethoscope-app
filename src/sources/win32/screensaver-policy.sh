# tryExec powershell 'Get-ItemProperty -Path "HKCU:\Software\Policies\Microsoft\Windows\Control Panel\Desktop\" | Format-List'
 tryExec reg query 'HKCU\Software\Policies\Microsoft\Windows\Control Panel\Desktop'
 trim
 save output1

 extract ScreenSaveActive\s+REG_SZ\s+([0-9]*)
 defaultTo -1
 save screenSaveActive

 load output1
 extract ScreenSaverIsSecure\s+REG_SZ\s+([0-9]*)
 defaultTo -1
 save screenSaverIsSecure

 load output1
 extract ScreenSaveTimeout\s+REG_SZ\s+([0-9]*)
 defaultTo -1
 save screenSaveTimeout

 remove output1