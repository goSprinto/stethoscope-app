/**
  Adds minimumSystemVersion to dist/latest-mac.yml.

  Electron 44 needs macOS 13 (Ventura) or later. electron-updater skips an
  update when the feed's minimumSystemVersion is above os.release(), but
  electron-builder does not write that field, so without it Macs on 10.15-12
  would install this build and then never start again.

  The value is a Darwin kernel version, compared with os.release(): macOS 13 is
  Darwin 22. Run after electron-builder and before uploading the feed.
 */
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const MINIMUM_DARWIN_VERSION = '22.0.0' // macOS 13 Ventura

function setMinimumSystemVersion (feedPath, version = MINIMUM_DARWIN_VERSION) {
  const info = yaml.load(fs.readFileSync(feedPath, 'utf8'))
  if (!info || !info.version || !Array.isArray(info.files)) {
    throw new Error(`${feedPath} is not an update feed`)
  }
  info.minimumSystemVersion = version
  fs.writeFileSync(feedPath, yaml.dump(info, { lineWidth: -1 }))
  return info
}

if (require.main === module) {
  const feedPath = process.argv[2] || path.join(__dirname, '../dist/latest-mac.yml')
  if (!fs.existsSync(feedPath)) {
    console.error(`No update feed at ${feedPath}; nothing to set`)
    process.exit(1)
  }
  setMinimumSystemVersion(feedPath)
  console.log(`Set minimumSystemVersion ${MINIMUM_DARWIN_VERSION} in ${feedPath}`)
}

module.exports = { setMinimumSystemVersion, MINIMUM_DARWIN_VERSION }
