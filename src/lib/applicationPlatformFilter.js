import kmd from './kmd'

// Filter applications array (specified in validation policy), return only those
// elements appropriate for the running OS platform/version
export default async function applicationPlatformFilter (applications = [], context, platform, version) {
  const osPlatform = platform || process.platform

  // Note: removed OS version check
  return applications.filter((app) => {
    if (!app.platform || app.platform.all) {
      return true
    }
    const platformStringRequirement = app.platform[osPlatform]
    return platformStringRequirement
  })
}
