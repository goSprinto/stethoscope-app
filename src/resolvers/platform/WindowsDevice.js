import kmd from "../../lib/kmd";
import { safeParseInt } from "../../lib/scripts";

export default {
  async friendlyName(root, args, context) {
    const result = await kmd("hardware", context);
    return result.system.hardwareVersion;
  },

  async disks(root, args, context) {
    return null;
  },

  async screenLockDelay(root, args, context) {
    try {
      const lock = await kmd("screensaver", context);
      const screenlockDelay = safeParseInt(lock.screenlockDelay);
      let screenSaveTimeout;
      try {
        const lockwithPolicy = await kmd("screensaver-policy", context);
        screenSaveTimeout = safeParseInt(lockwithPolicy.screenSaveTimeout);
      } catch (e) {
        log.error(
          "windowsDevice:screenLockDelay:lockwithPolicy::crash",
          e.toString()
        );
      }

      if (screenlockDelay === -1) return screenSaveTimeout;
      else return screenlockDelay;
    } catch (error) {
      log.error("windowsDevice:screenLockDelay::crash", e.toString());
      return 0;
    }
  },

  async antivirus(root, args, context) {
    const installedAntivirus = (await kmd("antivirus", context))
      .antivirusProducts;
    const activeAntiVirus = installedAntivirus
      .filter(({ productState }) => {
        // Convert productState to Hex of 6 digits. The 3rd character
        // indicates if the antivirus is enable or not.
        const state = safeParseInt(productState).toString(16).padStart(6, 0);
        return state.substr(2, 1) === "1";
      })
      .map(({ name }) => {
        return {
          name,
        };
      });
    return activeAntiVirus;
  },
};
