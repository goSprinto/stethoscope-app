#!/usr/bin/env kmd
exec /usr/bin/fdesetup status
extract FileVault is (Off|On).
save fileVaultEnabled
