// Note:
// We have windows and Linux builds.
// Windows binaries (exe, dlls, installer, uninstaller) are signed by
// electron-builder through scripts/windowsSign.js, after it has finished
// editing them. Signing here ran too early: the exe was changed afterwards
// and the installer and uninstaller did not exist yet (V8-2295).
// for linux we need to add removal of rpath

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
            console.log('Windows signing runs later, in electron-builder (scripts/windowsSign.js)');
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
