import log from '../logger'
import getDarwinAppUsage from './darwin'
import getWin32AppUsage from './win32'

// Linux has no unprivileged equivalent: dpkg knows nothing about launches, and
// the sources that do (process accounting, auditd, per-app systemd scopes) need
// root or a package that is not installed by default.
const USAGE_PROVIDERS = {
  darwin: getDarwinAppUsage,
  win32: getWin32AppUsage
}

const EMPTY_USAGE = { lastUsedAt: null, useCount: null }

/**
 * Reads when each application was last launched and how many times.
 *
 * Returns a Map keyed by the app's index in `apps`, because neither platform can
 * be relied on to give a unique name or path to key by. A platform with no
 * provider, or a provider that fails, yields an empty Map: usage is
 * supplementary, so it must never fail the surrounding inventory.
 */
export default async function getAppUsage (apps = []) {
  const provider = USAGE_PROVIDERS[process.platform]
  if (!provider || !apps.length) return new Map()

  try {
    return await provider(apps)
  } catch (e) {
    log.error('appUsage failed', {
      platform: process.platform,
      err: e && e.message ? e.message : String(e)
    })
    return new Map()
  }
}

/**
 * Attaches usage to each app, defaulting to nulls so the shape stays uniform
 * across platforms. A null lastUsedAt means "unknown", never "never launched":
 * on macOS the metadata is reset when an app self-updates its bundle, and on
 * Windows an app launched outside Explorer is never recorded.
 */
export const withAppUsage = (apps = [], usage = new Map()) =>
  apps.map((app, index) => ({ ...app, ...EMPTY_USAGE, ...usage.get(index) }))
