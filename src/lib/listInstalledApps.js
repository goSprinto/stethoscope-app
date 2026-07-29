import kmd from './kmd'
import { DEFAULT_WIN32_APP_REGISTRY_PATH } from '../constants'
import { isAiApp } from './aiAppMatcher'
import { loadAiAppDefinitions } from './appConfig'

const CACHE_KEY = '__installedApps'

// system_profiler reaches deep into the OS and reports framework and
// CoreServices bundles alongside real applications -- roughly two thirds of its
// output. Those are genuine .app bundles but not user-facing applications, so
// they are excluded.
const EXCLUDED_PATH_PREFIXES = ['/System/Library']

// It also reports .service/.appex bundles and cache directories, so only .app
// bundles are of interest here.
const isUserFacingApp = ({ path }) =>
  Boolean(path) &&
  path.endsWith('.app') &&
  !EXCLUDED_PATH_PREFIXES.some(prefix => path.startsWith(prefix))

const shape = ({ name, version, path }) => ({
  name,
  // an absent version must stay null rather than '' so the GraphQL layer
  // reports it as null instead of failing the field
  version: version || null,
  path: path || null
})

const listDarwinApps = async (context) => {
  const { apps = [] } = await kmd('apps', context)
  return apps.filter(isUserFacingApp).map(shape)
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

  const aiAppDefinitions = loadAiAppDefinitions()
  const runningProcesses = await getRunningProcessNames(context)

  apps = apps
    // drop anything the source could not give us a name for
    .filter(({ name }) => Boolean(name))
    .map((app) => ({
      ...app,
      isAiApp: isAiApp(app.name, aiAppDefinitions),
      isRunning: runningProcesses.has(normalizeProcessName(app.name))
    }))

  context[CACHE_KEY] = apps
  return apps
}

/** The installed applications that match the AI application catalog. */
export async function listAiInstalledApps (context = {}) {
  const apps = await listInstalledApps(context)
  return apps.filter(({ isAiApp: ai }) => ai)
}
