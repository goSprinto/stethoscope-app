import kmd from './kmd'

// Filter applications array (specified in validation policy), return only those
// elements appropriate for the running OS platform/version
export default async function applicationPlatformFilter (applications = [], context, platform, version) {
  const osPlatform = platform || process.platform
  let osVersion 
  if(version){
    osVersion = version
  } else {
    const result = await kmd('os', context)
    const distroId = result.system.distroId;
    if (distroId == "debian") {
      osVersion = result.system.debian_version;
    }else{
      osVersion = result.system.version || result.system.lsb_version;
    }
  }

  // Note: removed OS version check
  return applications.filter((app) => {
    if (!app.platform || app.platform.all) {
      return true
    }
    const platformStringRequirement = app.platform[osPlatform]
    return platformStringRequirement
  })
}
