// Note: 
// We have windows and Linux builds.
// For windows we need to sign the exe and dlls
// for linux we need to add removal of rpath

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Windows signing uses the code-signing certificate on the USB hardware
// token (V8-2214). signtool picks the certificate from the Windows store by
// its SHA-1 thumbprint, and the token's own software asks for the PIN, so
// the build never handles a PFX file or a password.
// SHA1KEY: thumbprint of the certificate on the token (certmgr, or
// `certutil -user -store My`); spaces are ignored
function certificateThumbprint() {
    const thumbprint = (process.env.SHA1KEY || '').replace(/\s/g, '');
    if (!/^[0-9a-fA-F]{40}$/.test(thumbprint)) {
        throw new Error('SHA1KEY must be the 40-character thumbprint of the signing certificate on the hardware token');
    }
    return thumbprint;
}

// Function to get signtool path
function getSigntoolPath() {
    const programFiles = process.env['ProgramFiles(x86)'];
    const signtool2022 = path.join(programFiles, 'Windows Kits', '10', 'bin', '10.0.17763.0', 'x86', 'signtool.exe');
    const signtoolDefault = path.join(programFiles, 'Windows Kits', '10', 'bin', 'x64', 'signtool.exe');

    if (fs.existsSync(signtool2022)) {
        return signtool2022;
    }
    return signtoolDefault;
}

// signtool arguments for one run over several files. No /f or /p: the
// certificate and its key stay on the token
function signArgs(thumbprint, files) {
    return [
        'sign',
        '/sha1', thumbprint,
        '/tr', 'http://timestamp.comodoca.com/?td=sha256',
        '/td', 'sha256',
        '/fd', 'sha256',
        ...files,
    ];
}

// the .dll and .exe files under dir
function findBinaries(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((file) => {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) return findBinaries(fullPath);
        return /\.(dll|exe)$/i.test(file.name) ? [fullPath] : [];
    });
}

// groups files so each signtool command line stays under Windows' 32K
// character limit. Each signtool run can ask for the token PIN once, so
// this keeps it to one prompt for a normal build
function batchFiles(files, maxChars = 30000) {
    const batches = [];
    let current = [];
    let length = 0;
    for (const file of files) {
        if (current.length && length + file.length + 3 > maxChars) {
            batches.push(current);
            current = [];
            length = 0;
        }
        current.push(file);
        length += file.length + 3;
    }
    if (current.length) batches.push(current);
    return batches;
}

function signWindowsBinaries(dir) {
    const thumbprint = certificateThumbprint();
    const files = findBinaries(dir);
    const signtool = getSigntoolPath();
    for (const batch of batchFiles(files)) {
        console.log(`Signing ${batch.length} file(s):\n  ${batch.join('\n  ')}`);
        try {
            execFileSync(signtool, signArgs(thumbprint, batch), { stdio: 'inherit' });
        } catch (error) {
            const reason = error.status != null ? `signtool exited with ${error.status}` : error.code;
            throw new Error(`Error signing: ${reason}. Is the hardware token plugged in and unlocked?`);
        }
    }
    console.log(`Signed ${files.length} file(s)`);
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
        if (platform === 'win32') {
            console.log('Signing Windows DLLs and EXEs with the hardware token...');
            signWindowsBinaries(appOutDir);
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

// for tests
module.exports.signArgs = signArgs;
module.exports.batchFiles = batchFiles;
module.exports.findBinaries = findBinaries;
module.exports.certificateThumbprint = certificateThumbprint;
