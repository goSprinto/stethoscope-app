import kmd from './kmd'
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
  // the registry gives us a publisher rather than an install path
  return apps.map(({ name, version, publisher }) => ({
    name,
    version: version || null,
    path: publisher || null
  }))
}

const listLinuxApps = async (context) => {
  const { apps = [] } = await kmd('apps', context)
  return apps.map(({ name, version }) => ({
    name,
    version: version || null,
    path: null
  }))
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

  let apps = []

  switch (process.platform) {
    case 'darwin':
      apps = await listDarwinApps(context)
      break
    case 'win32':
      apps = await listWin32Apps(context)
      break
    case 'linux':
    case 'ubuntu':
      apps = await listLinuxApps(context)
      break
  }

  const runningProcesses = await getRunningProcessNames(context)

  apps = apps
    // drop anything the source could not give us a name for
    .filter(({ name }) => Boolean(name))
    .map((app) => ({
      ...app,
      isRunning: runningProcesses.has(normalizeProcessName(app.name))
    }))

  context[CACHE_KEY] = apps
  return apps
}
