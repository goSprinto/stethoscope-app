#/usr/bin/env kmd
exec reg query '%REGISTRY_PATH%'
trim
lines
  save _line
  template reg query '{_line}'
  exec
  trim
  save _output

  extract DisplayName\s+[A-Z\s_]+\s+(.*)
  save name
  save displayName

  load _output
  extract Publisher\s+[A-Z\s_]+\s+(.*)
  save publisher

  load _output
  extract InstallDate\s+[A-Z\s_]+\s+(.*)
  parseDate YYYYMMDD
  save installDate

  # the directory the app was installed into, used to attribute UserAssist
  # launch records to this app
  load _output
  extract InstallLocation\s+[A-Z\s_]+\s+(.*)
  save installLocation

  load _output
  extract DisplayVersion\s+[A-Z\s_]+\s+(.*)
  save version

  remove _output
  remove _line
noEmpty
save apps
