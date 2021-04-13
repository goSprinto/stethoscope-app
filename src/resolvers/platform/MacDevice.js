import kmd from '../../lib/kmd'
import macFriendlyName from '../../sources/macmodels'
import applicationRunningFilter from '../../lib/applicationRunningFilter'

const MacDevice = {
  async friendlyName (root, args, context) {
    const result = await kmd('hardware', context)

    // The friendlyName implementation is inaccurate.
    // Better to stick with Model Name reported by
    // the system.
    //const hardwareModel = result.system.hardwareVersion
    //return macFriendlyName(hardwareModel)

    return result.system.modelName + ' (' + result.system.hardwareVersion + ')'
  },

  async disks (root, args, context) {
    const fileVault = await kmd('file-vault', context)
    const result = await kmd('disks', context)
    const encrypted = fileVault.fileVaultEnabled === 'true'
    return result.disks.map((disk, i) => {
      const res = {
        encrypted: disk.encrypted,
        label: disk.label,
        name: disk.label,
        uuid: disk.uuid
      }

      if (i === 0) {
        res.encrypted = encrypted
      }

      return res
    })
  },

  async applications (root, args, context) {
    // const result = await kmd('apps', context)
    return []
  },

  async screenLockDelay (root, args, context) {
    const settings = await kmd('screen-lock', context)
    // idleDelay is the time for the session to become
    // idle and screensaver to come on.
    // lockDelay is time since the screensaver comes on
    // and screen is locked
    const { lockDelay, idleDelay } = settings.screen

    // idleDelay = 0 -> Set to never in settings
    // idleDelay = -1 -> We were not able to extract since
    // likely it was never manually set by the user. Default
    // is set to 1200 seconds which is high.

    // lockDelay = -1: lock is disabled. 0: locks immediately on idle
    if (lockDelay >= 0 && idleDelay > 0) {
        return parseInt(idleDelay, 10) + parseInt(lockDelay, 10)
    }

    return -1;
  },

  async antivirus (root, args, context) {
    return await applicationRunningFilter(args.providers, context)
  }

}

export default MacDevice
