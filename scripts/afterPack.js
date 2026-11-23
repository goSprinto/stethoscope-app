// Note: 
// We have windows and Linux builds.
// For windows we need to sign the exe and dlls
// for linux we need to add removal of rpath

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Writes the signing certificate for one build and returns it with a
// cleanup function. The PFX goes to a new private temp folder (mode 0600)
// and is deleted afterwards: a fixed path in the shared temp folder outlived
// the build and could be swapped for another file (V8-2214)
function openCertificate() {
    const certPassword = process.env.WINDOZE_CERT_PASSWORD;
    const certData = process.env.WINDOZE_CERT_DATA;
    const sha1Key = process.env.SHA1KEY;

    if (!certData || !certPassword || !sha1Key) {
        throw new Error('Missing required environment variables for signing');
    }

    const certDir = fs.mkdtempSync(path.join(os.tmpdir(), 'drsprinto-sign-'));
    const certPath = path.join(certDir, 'cert.p12');
    fs.writeFileSync(certPath, Buffer.from(certData, 'base64'), { mode: 0o600 });

    return {
        certPath,
        certPassword,
        sha1Key,
        close() {
            fs.rmSync(certDir, { recursive: true, force: true });
        }
    };
}

// Function to get signtool path: SIGNTOOL_PATH if set, otherwise the newest
// Windows SDK signtool. Only two fixed SDK versions used to be checked, so on a
// machine with any other SDK (e.g. 10.0.22621.0) signing failed.
function getSigntoolPath() {
    if (process.env.SIGNTOOL_PATH) {
        return process.env.SIGNTOOL_PATH;
    }
    const programFiles = process.env['ProgramFiles(x86)'];
    const sdkBin = path.join(programFiles, 'Windows Kits', '10', 'bin');
    const versioned = fs.existsSync(sdkBin)
        ? fs.readdirSync(sdkBin)
            .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
            .reverse()
            .map((version) => path.join(sdkBin, version, 'x64', 'signtool.exe'))
        : [];
    const candidates = [...versioned, path.join(sdkBin, 'x64', 'signtool.exe')];
    return candidates.find((candidate) => fs.existsSync(candidate)) || 'signtool.exe';
}

// Function to sign DLLs and EXEs
// signtool takes the PFX password only as /p, so it is still in signtool's
// own arguments. It is run without a shell, and errors are reported without
// the command line, which held the password
function signFile(filePath, cert) {
    const signtool = getSigntoolPath();
    const args = [
        'sign',
        '/f', cert.certPath,
        '/p', cert.certPassword,
        '/tr', 'http://timestamp.comodoca.com/?td=sha256',
        '/td', 'sha256',
        '/fd', 'sha256',
        '/sha1', cert.sha1Key,
        filePath,
    ];

    console.log(`Signing file: ${filePath}`);
    try {
        execFileSync(signtool, args, { stdio: 'inherit' });
    } catch (error) {
        const reason = error.status != null ? `signtool exited with ${error.status}` : error.code;
        throw new Error(`Error signing ${filePath}: ${reason}`);
    }
    console.log(`Successfully signed: ${filePath}`);
}

function signAllDlls(dir, cert) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((file) => {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            signAllDlls(fullPath, cert);
        } else if (file.name.endsWith('.dll') || file.name.endsWith('.exe')) {
            signFile(fullPath, cert);
        }
    });
}

// Functions for RPATH removal (from remove-rpath.js)
function isELF(filePath) {
    const output = execSync(`file "${filePath}"`).toString();
    return output.includes('ELF');
}

function removeRpath(filePath) {
    try {
        const result = execSync(`chrpath -l "${filePath}"`, { stdio: 'pipe' }).toString();
        if (result.includes('RPATH')) {
            execSync(`chrpath -d "${filePath}"`);
            console.log(`Removed RPATH from: ${filePath}`);
        }
    } catch (err) {
        // chrpath returns error if no RPATH found — ignore
    }
}

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            walk(filePath);
        } else if (stat.isFile() && isELF(filePath)) {
            removeRpath(filePath);
        }
    }
}

// Main afterPack function
module.exports = async function (context) {
    const appOutDir = context.appOutDir;
    const platform = context.electronPlatformName;

    console.log(`Running afterPack for platform: ${platform}`);

    try {
        if (platform === 'win32' && process.env.WIN_SIGN_CERT_SHA1) {
            // hardware token build (scripts/buildWindowsWithToken.js):
            // electron-builder signs everything from the certificate store
            // after this hook, so signing here would only be redone
            console.log('Token signing: electron-builder signs the app, skipping afterPack signing');
        } else if (platform === 'win32') {
            console.log('Signing Windows DLLs and EXEs...');
            const cert = openCertificate();
            try {
                signAllDlls(appOutDir, cert);
            } finally {
                cert.close();
            }
            console.log('Windows signing completed successfully');
        } else if (platform === 'linux') {
            console.log(`Skipping afterPack for platform: ${platform}`);
            // console.log('Removing RPATH from Linux binaries...');
            // walk(appOutDir);
            // console.log('Linux RPATH removal completed successfully');
        } else {
            console.log(`Skipping afterPack for platform: ${platform}`);
        }
    } catch (error) {
        console.error('Error in afterPack:', error.message);
        throw error; // Re-throw to ensure build fails if there's an error
    }
}; 
