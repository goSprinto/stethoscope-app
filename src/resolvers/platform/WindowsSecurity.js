import semver from "../../lib/patchedSemver";
import kmd from "../../lib/kmd";
import { UNKNOWN, DEFAULT_WIN32_APP_REGISTRY_PATH } from "../../constants";
import WindowsDevice from "./WindowsDevice";
import { safeParseInt } from "../../lib/scripts";

export default {
  async automaticUpdates(root, args, context) {
    const result = await kmd("automatic-updates", context);
    return result.automaticUpdatesNotificationLevel > 1;
  },

  async remoteLogin(root, args, context) {
    const device = await kmd("os", context);
    // aws workspaces require remote login
    if (device.system.platform === "awsWorkspace") {
      return false;
    }

    const prefs = await kmd("remote-desktop", context);
    return prefs.sharingPreferences.remoteDesktopDisabled !== "1";
  },

  async diskEncryption(root, args, context) {
    const device = await kmd("os", context);
    // workspaces don't support disk encryption - bail
    if (device.system.platform === "awsWorkspace") {
      return true;
    }

    const disk = await kmd("bitlocker", context);

    return disk.bitlockerStatus && disk.bitlockerStatus === "ON";
  },

  async screenLock(root, args, context) {
    const device = await kmd("os", context);
    // screen lock creates problems in workspaces
    if (device.system.platform === "awsWorkspace") {
      return UNKNOWN;
    }

    try {
      const lock = await kmd("screensaver", context);

      let screenSaverIsSecure = null;
      let screenSaveActive = null;
      try {
        const lockwithPolicy = await kmd("screensaver-policy", context);

        screenSaverIsSecure = safeParseInt(lockwithPolicy.screenSaverIsSecure);
        screenSaveActive = safeParseInt(lockwithPolicy.screenSaveActive);
      } catch (e) {
        log.error(
          "windowsSecurity:screenLock:lockwithPolicy::crash",
          e.toString()
        );
      }
      return (
        (lock.screensaverEnabled === "True" &&
          lock.screenlockEnabled === "True") ||
        (screenSaveActive === 1 && screenSaverIsSecure === 1)
      );
    } catch (error) {
      log.error("windowsSecurity:screenLock::crash", e.toString());
      return false;
    }
  },

  async screenIdle(root, args, context) {
    const { screenIdle } = args;

    try {
      const lock = await kmd("screensaver", context);
      const screenlockDelay = safeParseInt(lock.screenlockDelay);
      const delayOk = semver.satisfies(
        semver.coerce(screenlockDelay.toString()),
        screenIdle
      );

      let newdelayOk = false;
      let screenSaverIsSecure, screenSaveActive;
      try {
        const lockwithPolicy = await kmd("screensaver-policy", context);
        const screenSaveTimeout = safeParseInt(
          lockwithPolicy.screenSaveTimeout
        );
        newdelayOk = semver.satisfies(
          semver.coerce(screenSaveTimeout.toString()),
          screenIdle
        );
        screenSaverIsSecure = safeParseInt(lockwithPolicy.screenSaverIsSecure);
        screenSaveActive = safeParseInt(lockwithPolicy.screenSaveActive);
      } catch (e) {
        log.error(
          "windowsSecurity:screenIdle:lockwithPolicy::crash",
          e.toString()
        );
      }

      return (
        (delayOk &&
          lock.screensaverEnabled === "True" &&
          lock.screenlockEnabled === "True") ||
        (newdelayOk && screenSaverIsSecure === 1 && screenSaveActive === 1)
      );
    } catch (error) {
      log.error("windowsSecurity:screenIdle::crash", e.toString());
      return false;
    }
  },

  async firewall(root, args, context) {
    const result = await kmd("firewall", context);
    return result.firewalls.every((fw) => fw.status === "ON");
  },

  async applications(root, appsToValidate, context) {
    // gather set of optional registry path overrides from policy
    const registryPathOverrides = new Set();
    appsToValidate.map(({ paths = {} }) => {
      registryPathOverrides.add(paths.win32 || DEFAULT_WIN32_APP_REGISTRY_PATH);
    });

    const paths = Array.from(registryPathOverrides);

    let foundApps = [];
    for (const path of paths) {
      const appsAtRegPath = await kmd("apps", context, { REGISTRY_PATH: path });
      foundApps = foundApps.concat(appsAtRegPath.apps);
    }

    return appsToValidate.map(({ exactMatch = false, name, version }) => {
      let userApp = false;

      if (!exactMatch) {
        userApp = foundApps.find((app) =>
          new RegExp(name, "ig").test(app.name)
        );
      } else {
        userApp = foundApps.find((app) => app.name === name);
      }

      // app isn't installed
      if (!userApp) return { name, reason: "NOT_INSTALLED" };
      // app is out of date
      if (version && !semver.satisfies(userApp.version, version)) {
        return { name, version: userApp.version, reason: "OUT_OF_DATE" };
      }

      return { name, version: userApp.version };
    });
  },

  async antivirus(root, args, context) {
    return await WindowsDevice.antivirus(root, args, context);
  },
};
