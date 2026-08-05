import kmd from './kmd'
import log from './logger'
import getAppUsage, { withAppUsage } from './appUsage'
import { DEFAULT_WIN32_APP_REGISTRY_PATH } from '../constants'

const CACHE_KEY = '__installedApps'

// Applications a user installed live in /Applications or ~/Applications. Anything else
// system_profiler reports -- framework bundles, CoreServices, Script Editor templates, helper
// agents nested inside other apps, and .app directories inside project folders -- is not an
// installed application.
const USER_APP_PATH_PATTERN = /^(\/Applications\/|\/Users\/[^/]+\/Applications\/)/

// Apple's own bundles are reported as obtained_from "apple"; everything the user installed comes
// from the App Store, an identified developer, or an unsigned source.
const APPLE_SOURCE = 'apple'

const isUserInstalledApp = ({ path, obtainedFrom }) =>
  Boolean(path) && path.endsWith('.app') && obtainedFrom !== APPLE_SOURCE && USER_APP_PATH_PATTERN.test(path)

const shape = ({ name, version, path }) => ({
  name,
  // an absent version must stay null rather than '' so the GraphQL layer
  // reports it as null instead of failing the field
  version: version || null,
  path: path || null
})

const listDarwinApps = async (context) => {
  const { apps = [] } = await kmd('apps', context)
  return apps.filter(isUserInstalledApp).map(shape)
}

const listWin32Apps = async (context) => {
  const { apps = [] } = await kmd('apps', context, {
    REGISTRY_PATH: DEFAULT_WIN32_APP_REGISTRY_PATH
  })
  // the uninstall registry has no bundle equivalent, so `path` is the install
  // directory -- which is also what the UserAssist join matches against
  return apps.map(({ name, version, installLocation }) => ({
    name,
    version: version || null,
    path: installLocation || null
  }))
}

// dpkg-query only exists on Debian-derived distros, so this returns nothing on
// the Fedora and Manjaro builds rather than failing.
const listLinuxApps = async (context) => {
  const { apps = [] } = await kmd('apps', context)
  return apps.map(({ name, version }) => ({
    name,
    version: version || null,
    path: null
  }))
}

const APP_LISTERS = {
  darwin: listDarwinApps,
  win32: listWin32Apps,
  linux: listLinuxApps,
  ubuntu: listLinuxApps
}

// process names and application names are compared case-insensitively, and
// Windows reports processes with the .exe suffix that the app name lacks
const normalizeProcessName = (name = '') =>
  String(name)
    .replace(/\.exe$/i, '')
    .trim()
    .toLowerCase()

const getRunningProcessNames = async (context) => {
  try {
    const { processList = [] } = await kmd('process-list', context)
    return new Set(processList.map(({ appName }) => normalizeProcessName(appName)))
  } catch (e) {
    // a missing or failing process list must not fail the whole app listing
    return new Set()
  }
}

/**
 * Enumerates the applications installed on the device. Results are memoized on
 * the request context, so several resolvers can ask for them within one scan
 * without re-running the underlying query.
 */
export default async function listInstalledApps (context = {}) {
  if (context[CACHE_KEY]) {
    return context[CACHE_KEY]
  }

  const listApps = APP_LISTERS[process.platform]
  let apps = []

  if (listApps) {
    try {
      apps = await listApps(context)
    } catch (e) {
      // installedApplications is non-null in the schema, so a throw here would
      // null out the entire Device object and fail the scan. An unavailable
      // package source (dpkg-query on a non-Debian distro, a missing registry
      // key) must degrade to an empty list instead.
      log.error('listInstalledApps failed', {
        platform: process.platform,
        err: e && e.message ? e.message : String(e)
      })
      apps = []
    }
  }

  // drop anything the source could not give us a name for
  apps = apps.filter(({ name }) => Boolean(name))

  const [runningProcesses, usage] = await Promise.all([
    getRunningProcessNames(context),
    getAppUsage(apps)
  ])

  apps = withAppUsage(apps, usage).map((app) => ({
    ...app,
    isRunning: runningProcesses.has(normalizeProcessName(app.name))
  }))

  context[CACHE_KEY] = apps
  return apps
}
