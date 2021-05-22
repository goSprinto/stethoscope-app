pathResolve \\verastatus\\VeraStatus.exe
save verastatus_path
template '{verastatus_path}'
tryExec

extract System Encryption\s*:\s*([^\r\n]+)
defaultTo no
save veracryptStatus

remove verastatus_path