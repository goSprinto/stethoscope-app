import Store from 'electron-store'

const SETTING_KEY = 'installedAppDiscoveryEnabled'

const settings = new Store({ name: 'settings' })

/**
 * Whether this device's organization has opted in to installed-application discovery.
 *
 * Sprinto sends the decision next to the policy (`settings.installedAppDiscovery`). Anything other
 * than an explicit `true` -- an older server, a failed request, a disconnected device -- means off,
 * so applications are never listed or reported without a current opt-in.
 */
export const isInstalledAppDiscoveryEnabled = () => settings.get(SETTING_KEY) === true

export const updateInstalledAppDiscovery = (remoteSettings) => {
  settings.set(SETTING_KEY, Boolean(remoteSettings && remoteSettings.installedAppDiscovery === true))
}

export const disableInstalledAppDiscovery = () => {
  settings.set(SETTING_KEY, false)
}
