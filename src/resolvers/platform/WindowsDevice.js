import kmd from '../../lib/kmd'

export default {
  async friendlyName (root, args, context) {
    const result = await kmd('hardware', context)
    return result.system.hardwareVersion
  },

  async disks (root, args, context) {
    return null
  },

  async screenLockDelay (root, args, context) {
    const lock = await kmd('screenlock', context)
    const chargingTimeout = parseInt(lock.chargingTimeout, 10)
    const batteryTimeout = parseInt(lock.batteryTimeout, 10)

    return Math.min(chargingTimeout, batteryTimeout)
  }
}
