#!/usr/bin/env kmd
tryExec defaults read /Library/Apple/System/Library/CoreServices/XProtect.bundle/Contents/Info.plist CFBundleShortVersionString
defaultTo NotFound
save xprotectVersion
