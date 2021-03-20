import kmd from './kmd'
import applicationPlatformFilter from './applicationPlatformFilter'

// Filter applications array (specified in validation policy), return only those
// elements that are currently running
export default async function applicationRunningFilter (applications = [], context, platform, version) {
  // All running process. May have multiple copies of same app running
  const processList = (await kmd('process-list', context)).processList
  // Get the unique running apps
  const runningApps = new Set(processList.map(proc => proc.appName))

  const plateformProviders = await applicationPlatformFilter(applications, context, platform, version)
  return plateformProviders.filter(p => runningApps.has(p.name)).map(({ name }) => {
    return { name }
  })
}
