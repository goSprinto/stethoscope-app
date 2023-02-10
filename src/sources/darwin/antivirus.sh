#!/usr/bin/env kmd
exec defaults read /Library/Apple/System/Library/CoreServices/XProtect.bundle/Contents/Info.plist CFBundleShortVersionString
save line
save xprotectVersion
remove line