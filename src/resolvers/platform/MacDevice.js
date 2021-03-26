import kmd from '../../lib/kmd'
import macFriendlyName from '../../sources/macmodels'
import applicationRunningFilter from '../../lib/applicationRunningFilter'

const MacDevice = {
  async friendlyName (root, args, context) {
    const result = await kmd('hardware', context)
    const hardwareModel = result.system.hardwareVersion
    return macFriendlyName(hardwareModel)
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
    return parseInt(idleDelay, 10) + parseInt(lockDelay, 10)

  },

  async antivirus (root, args, context) {
    return await applicationRunningFilter(args.providers, context)
  }

}

export default MacDevice
