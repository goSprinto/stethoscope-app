// This script signs all DLLs from build generated for windows app

const { execSync } = require('child_process'); 
const fs = require('fs'); 
const path = require('path');

const certPath = "<add path for cert>"; 
const certPass = "<password>";

function signFile(filePath) {
     const command = `signtool sign /f "${certPath}" /p ${certPass} /tr http://timestamp.sectigo.com /td sha256 /fd sha256 /sha1 <add here> "${filePath}"`; 
     execSync(command, { stdio: 'inherit' }); 
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

module.exports = async function (context) {
    if (context.electronPlatformName === 'win32') {
        const appOutDir = context.appOutDir;
        signAllDlls(appOutDir);
    } else { console.log("skipping after pack for non windows app") } 
};