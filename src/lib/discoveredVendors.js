import { getAiAppMatch } from './aiAppMatcher'
import { loadAiAppDefinitions } from './appConfig'

export const VENDOR_CATEGORY_AI = 'AI_APPLICATION'
export const DISCOVERY_SOURCE = 'DR_SPRINTO_DESKTOP_SCAN'

/**
 * Turns the installed application list into vendor records, keeping only the
 * applications that matched the AI catalog. The catalog entry supplies the
 * vendor name, so "Cursor" reports vendor "Cursor" and "ChatGPT" reports
 * "OpenAI".
 */
export function buildDiscoveredVendors (installedApplications = [], device = {}) {
  const aiAppDefinitions = loadAiAppDefinitions()
  const detectedAt = new Date().toISOString()
  const { platform, deviceId, deviceName, osVersion } = device

  return installedApplications
    .filter(({ isAiApp }) => isAiApp)
    .map((app) => {
      const match = getAiAppMatch(app.name, aiAppDefinitions) || {}

      return {
        vendorName: match.vendor || match.name || app.name,
        applicationName: app.name,
        vendorCategory: match.category || VENDOR_CATEGORY_AI,
        version: app.version || null,
        isInstalled: true,
        isRunning: Boolean(app.isRunning),
        platform: platform || null,
        deviceId: deviceId || null,
        deviceName: deviceName || null,
        osVersion: osVersion || null,
        discoverySource: DISCOVERY_SOURCE,
        detectedAt
      }
    })
}

export default buildDiscoveredVendors
