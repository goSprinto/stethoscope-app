#!/usr/bin/env kmd
# Fallback to LocalHostName if ComputerName is not set
exec sh -c 'scutil --get ComputerName 2>/dev/null || scutil --get LocalHostName 2>/dev/null || hostname -s 2>/dev/null || hostname'
save system.hostname
