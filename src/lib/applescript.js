import applescript from 'applescript'
import { shell } from 'electron'
import os from 'os'
import { promisify } from 'util'
const execString = promisify(applescript.execString)

// macOS 13 Ventura is Darwin 22. Before Ventura there is no System Settings:
// the System Preferences era pane ids are the correct ones and the Settings
// extension ids below do not exist, so the mapping must only apply from
// Ventura onwards. The x-apple.systempreferences: scheme itself works on both.
const VENTURA_DARWIN_MAJOR = 22
const isSystemSettingsEra = () =>
  parseInt(os.release(), 10) >= VENTURA_DARWIN_MAJOR

// macOS 13 (Ventura) replaced System Preferences with System Settings. The old
// `tell application "System Preferences" ... set the current pane to pane id`
// AppleScript no longer works: the app name still resolves through Apple's
// redirect shim, so Settings opens, but setting the pane fails with -10006 and
// the user is dropped on whichever pane happens to be showing.
//
// The supported replacement is the x-apple.systempreferences: URL scheme,
// addressed by the bundle id of the Settings extension. These ids were taken
// from /System/Library/ExtensionKit/Extensions rather than guessed, and are
// case sensitive.
const SETTINGS_PANES = {
  'com.apple.preferences.appstore': 'com.apple.Software-Update-Settings.extension',
  'com.apple.preferences.softwareupdate': 'com.apple.Software-Update-Settings.extension',
  'com.apple.preference.security': 'com.apple.settings.PrivacySecurity.extension',
  'com.apple.preference.desktopscreeneffect': 'com.apple.Lock-Screen-Settings.extension',
  'com.apple.preference.screensaver': 'com.apple.Lock-Screen-Settings.extension',
  'com.apple.preference.network': 'com.apple.Network-Settings.extension',
  'com.apple.preferences.sharing': 'com.apple.Sharing-Settings.extension',
  'com.apple.preference.sharing': 'com.apple.Sharing-Settings.extension',
  'com.apple.preferences.users': 'com.apple.Users-Groups-Settings.extension'
}

// already-modern ids look like com.apple.Foo-Settings.extension or
// com.apple.settings.Foo.extension
const MODERN_PANE = /^com\.apple\.([\w-]+-Settings\.extension|settings\.[\w.]+)$/i

const openPreferences = async function (preferencePaneId) {
  // only allow word characters, dots and dashes -- modern pane ids contain
  // dashes, and this keeps the value safe to interpolate
  const safePreferencePaneId = String(preferencePaneId).replace(/[^\w.-]/g, '')

  // pre-Ventura the incoming id is already the right one for System
  // Preferences, and the modern extension ids would not resolve
  if (!isSystemSettingsEra()) {
    return shell.openExternal(
      `x-apple.systempreferences:${safePreferencePaneId}`
    )
  }

  const lookup = safePreferencePaneId.toLowerCase()

  let pane = SETTINGS_PANES[lookup]

  if (!pane) {
    // legacy ids sometimes carry an anchor (e.g. security?FileVault), which the
    // caller's sanitiser flattens into the id -- match on the prefix instead
    const prefix = Object.keys(SETTINGS_PANES).find((key) => lookup.startsWith(key))
    if (prefix) pane = SETTINGS_PANES[prefix]
  }

  if (!pane && MODERN_PANE.test(safePreferencePaneId)) {
    pane = safePreferencePaneId
  }

  // an unrecognised pane still gets the user into Settings, which beats an
  // unhandled rejection and a window that never opens
  return shell.openExternal(
    pane ? `x-apple.systempreferences:${pane}` : 'x-apple.systempreferences:'
  )
}

const openApp = async function (appName) {
  // only allow letters and spaces, we don't want any applescript injection attacks
  const safeAppName = appName.replace(/[^\w ]/g, '')
  const script = `tell application "${safeAppName}"
    activate
  end tell`
  return execString(script)
}

export default {
  openPreferences,
  openApp
}

if (require.main === module) {
  // openPreferences(');com.apple.preference.security')
  openApp('App Store')
}
