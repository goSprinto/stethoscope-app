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
    const lock = await kmd('screensaver', context)
    const screenlockDelay = parseInt(lock.screenlockDelay, 10)

    return screenlockDelay
  },

  async antivirus (root, args, context) {
    const installedAntivirus = (await kmd('antivirus', context)).antivirusProducts
    const activeAntiVirus = installedAntivirus.filter(({productState}) => {
      // Convert productState to Hex of 6 digits. The 3rd character
      // indicates if the antivirus is enable or not.
      const state = parseInt(productState, 10).toString(16).padStart(6,0)
      return state.substr(2, 1) === '1'
    }).map(({name}) => {
      return {
        name
      }
    })
    return activeAntiVirus
  }

}
