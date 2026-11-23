// Windows code signing with the certificate on the USB hardware token
// (V8-2214, V8-2295).
//
// electron-builder calls sign() for every file it signs (package.json
// build.win.signtoolOptions.sign):
//   - DrSprinto.exe, after it has flipped the fuses and edited the exe's
//     resources, so the signature is the last change made to the file
//   - the Electron DLLs next to the exe (signExts)
//   - the extra resources (bitlocker-status.exe and its DLLs) and anything in
//     app.asar.unpacked
//   - the NSIS installer and uninstaller
// Signing in afterPack instead ran before those edits, so the exe's signature
// did not survive, and it never saw the installer or uninstaller.
//
// signtool picks the certificate from the Windows store by its SHA-1
// thumbprint and the token's own software asks for the PIN, so the build
// never handles a PFX file or a password. With SafeNet Authentication Client,
// turn on "single logon" (Advanced View > Client Settings) so the PIN is asked
// once per build instead of once per file.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMESTAMP_URL = 'http://timestamp.comodoca.com/?td=sha256';

// SHA1KEY: thumbprint of the certificate on the token. To list it:
//   powershell "Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Format-List Subject,Thumbprint"
// Spaces are ignored
function certificateThumbprint(env = process.env) {
    const thumbprint = (env.SHA1KEY || '').replace(/\s/g, '');
    if (!/^[0-9a-fA-F]{40}$/.test(thumbprint)) {
        throw new Error('SHA1KEY must be the 40-character thumbprint of the signing certificate on the hardware token');
    }
    return thumbprint;
}

// SIGNTOOL_PATH if set, otherwise signtool from the newest installed Windows
// SDK. Only two fixed SDK versions used to be checked, so signing failed on a
// machine with any other SDK (e.g. 10.0.22621.0)
function getSigntoolPath(env = process.env, existsSync = fs.existsSync, readdirSync = fs.readdirSync) {
    if (env.SIGNTOOL_PATH) {
        return env.SIGNTOOL_PATH;
    }
    const programFiles = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const sdkBin = path.join(programFiles, 'Windows Kits', '10', 'bin');
    const versioned = existsSync(sdkBin)
        ? readdirSync(sdkBin)
            .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name))
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
            .map((version) => path.join(sdkBin, version, 'x64', 'signtool.exe'))
        : [];
    const candidates = [...versioned, path.join(sdkBin, 'x64', 'signtool.exe')];
    return candidates.find((candidate) => existsSync(candidate)) || 'signtool.exe';
}

// signtool arguments for one file. No /f or /p: the certificate and its key
// stay on the token. nest (/as) appends a signature instead of replacing one
function signArgs(thumbprint, file, nest = false) {
    return [
        'sign',
        '/sha1', thumbprint,
        '/tr', TIMESTAMP_URL,
        '/td', 'sha256',
        '/fd', 'sha256',
        ...(nest ? ['/as'] : []),
        file,
    ];
}

function signError(error, signtool) {
    if (error.code === 'ENOENT') {
        return new Error(`signtool was not found at ${signtool}. Install the Windows SDK, or set SIGNTOOL_PATH to signtool.exe`);
    }
    const reason = error.status != null ? `signtool exited with ${error.status}` : error.code || error.message;
    return new Error(`Error signing: ${reason}. Is the hardware token plugged in and unlocked?`);
}

// electron-builder's custom sign hook. configuration.path is the file to
// sign. A throw fails the build
async function sign(configuration, { env = process.env, run = execFileSync } = {}) {
    const thumbprint = certificateThumbprint(env);
    const signtool = getSigntoolPath(env);
    const file = configuration.path;
    console.log(`Signing ${file}`);
    try {
        run(signtool, signArgs(thumbprint, file, configuration.isNest), { stdio: 'inherit' });
    } catch (error) {
        throw signError(error, signtool);
    }
}

module.exports = { sign, signArgs, certificateThumbprint, getSigntoolPath };
