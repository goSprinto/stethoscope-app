// Note: 
// We have windows and Linux builds.
// For windows we need to sign the exe and dlls
// for linux we need to add removal of rpath

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Function to get certificate path and password from environment
function getCertificateInfo() {
    const tempDir = os.tmpdir();
    const certPath = path.join(tempDir, 'lando.windoze.p12');
    const certPassword = process.env.WINDOZE_CERT_PASSWORD;
    const certData = process.env.WINDOZE_CERT_DATA;
    const sha1Key = process.env.SHA1KEY;

    if (!certData || !certPassword || !sha1Key) {
        throw new Error('Missing required environment variables for signing');
    }

    // Write certificate to temp file if it doesn't exist
    if (!fs.existsSync(certPath)) {
        console.log(`Writing certificate to ${certPath}...`);
        const certBuffer = Buffer.from(certData, 'base64');
        fs.writeFileSync(certPath, certBuffer);
    }

    return {
        certPath,
        certPassword,
        sha1Key
    };
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

// Function to sign DLLs and EXEs
function signFile(filePath) {
    const { certPath, certPassword, sha1Key } = getCertificateInfo();
    const signtool = getSigntoolPath();

    const command = `"${signtool}" sign /f "${certPath}" /p "${certPassword}" /tr http://timestamp.comodoca.com/?td=sha256 /td sha256 /fd sha256 /sha1 ${sha1Key} "${filePath}"`;
    
    try {
        console.log(`Signing file: ${filePath}`);
        execSync(command, { stdio: 'inherit' });
        console.log(`Successfully signed: ${filePath}`);
    } catch (error) {
        console.error(`Error signing ${filePath}:`, error);
        throw error;
    }
}

function signAllDlls(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((file) => {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            signAllDlls(fullPath);
        } else if (file.name.endsWith('.dll') || file.name.endsWith('.exe')) {
            signFile(fullPath);
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
        if (platform === 'win32') {
            console.log('Signing Windows DLLs and EXEs...');
            signAllDlls(appOutDir);
            console.log('Windows signing completed successfully');
        } else if (platform === 'linux') {
            console.log('Removing RPATH from Linux binaries...');
            walk(appOutDir);
            console.log('Linux RPATH removal completed successfully');
        } else {
            console.log(`Skipping afterPack for platform: ${platform}`);
        }
    } catch (error) {
        console.error('Error in afterPack:', error);
        throw error; // Re-throw to ensure build fails if there's an error
    }
}; 