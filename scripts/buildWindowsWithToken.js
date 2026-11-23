/**
 * Windows build signed with a hardware token (EV certificate on a USB key).
 *
 *   set WIN_SIGN_CERT_SHA1=<certificate thumbprint>
 *   yarn build:windows:token
 *
 * The token's private key cannot be exported to a .p12, so instead of the
 * certificate file used by scripts/afterPack.js, electron-builder signs through
 * the Windows certificate store: signtool finds the certificate by thumbprint
 * and the token driver (SafeNet) asks for the PIN. electron-builder signs after
 * it has edited the exe and flipped the fuses, and also covers the installer
 * and uninstaller, which afterPack never sees.
 *
 * Tip: enable "single logon" in SafeNet Authentication Client (Advanced View >
 * Client Settings) so the PIN is asked once rather than for every file.
 */
const builder = require('electron-builder')

const thumbprint = (process.env.WIN_SIGN_CERT_SHA1 || '').replace(/\s/g, '')

if (!/^[0-9a-fA-F]{40}$/.test(thumbprint)) {
  console.error(
    'Set WIN_SIGN_CERT_SHA1 to the 40-character thumbprint of the code signing\n' +
      'certificate on the token. To list it:\n' +
      '  powershell "Get-ChildItem Cert:\\CurrentUser\\My -CodeSigningCert | Format-List Subject,Thumbprint"'
  )
  process.exit(1)
}

// electron-builder merges this with the "build" field of package.json, so only
// the signing overrides go here
const config = {
  win: {
    // sign every executable and library in the app, not just the main exe
    signExts: ['.dll', '.exe'],
    signtoolOptions: {
      certificateSha1: thumbprint,
      // SHA-1 signatures are obsolete; one signature per file also means one
      // token operation per file
      signingHashAlgorithms: ['sha256']
    }
  }
}

// --dir builds the unpacked app only (no installer), like electron-builder --dir
const target = process.argv.includes('--dir') ? 'dir' : undefined

builder
  .build({
    targets: builder.Platform.WINDOWS.createTarget(target),
    config
  })
  .then((files) => console.log('Built:\n  ' + files.join('\n  ')))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
