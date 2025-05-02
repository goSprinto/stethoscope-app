const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

exports.default = async function (context) {
  const appPath = context.appOutDir;
  console.log(`Scanning for ELF binaries in: ${appPath}`);
  walk(appPath);
};
