export const DISCOVERY_SOURCE = 'DR_SPRINTO_DESKTOP_SCAN'

/**
 * Turns the installed application list into the records reported to Sprinto.
 *
 * The agent does no classification: it reports the applications it found and Sprinto decides
 * whether each is an AI application and which vendor domain it belongs to. That keeps the
 * catalog server-side, so it can grow without shipping a new desktop release.
 */
export function buildDiscoveredVendors (installedApplications = [], device = {}) {
  const detectedAt = new Date().toISOString()
  const { platform, deviceId, deviceName, osVersion } = device

  return installedApplications.map((app) => ({
    applicationName: app.name,
    version: app.version || null,
    isInstalled: true,
    isRunning: Boolean(app.isRunning),
    platform: platform || null,
    deviceId: deviceId || null,
    deviceName: deviceName || null,
    osVersion: osVersion || null,
    discoverySource: DISCOVERY_SOURCE,
    detectedAt
  }))
}

export default buildDiscoveredVendors
