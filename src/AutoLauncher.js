import Store from "electron-store";
import AutoLaunch from "auto-launch";
import config from "./config.json";
import os from "os";

const settings = new Store({ name: "settings" });
export default class AutoLauncher {
  constructor(app, appName) {
    const autoLaunchOpts = {
      isHidden: true,
      name: appName || "Stethoscope",
    };
    if (os.platform() === "linux" && process.env.APPIMAGE) {
      autoLaunchOpts.path = process.env.APPIMAGE;
    }
    this.localApp = app;
    this.stethoscopeAutoLauncher = new AutoLaunch(autoLaunchOpts);
  }

  shouldPromptToEnable() {
    return config.autoLaunchPrompt && !settings.has("autoLaunch");
  }

  isEnabled() {
    return settings.get("autoLaunch") === "true";
  }

  disable(app) {
    if (os.platform() === "linux") {
      this.stethoscopeAutoLauncher.isEnabled().then((isEnabled) => {
        if (isEnabled) {
          this.stethoscopeAutoLauncher.disable();
        }
      });
    } else if (os.platform() === "windows") {
      app.setLoginItemSettings({
        openAtLogin: false,
      });
    } else {
      app.setLoginItemSettings({
        openAtLogin: false,
        openAsHidden: false,
      });
    }
    settings.set("autoLaunch", "false");
  }

  enable(app) {
    if (os.platform() === "linux") {
      this.stethoscopeAutoLauncher.isEnabled().then((isEnabled) => {
        if (!isEnabled) {
          this.stethoscopeAutoLauncher.enable();
        }
      });
    } else if (os.platform() === "windows") {
      const appFolder = path.dirname(process.execPath);
      const updateExe = path.resolve(appFolder, "..", "`${app.appName}`.exe");
      const exeName = path.basename(process.execPath);

      app.setLoginItemSettings({
        openAtLogin: true,
        path: updateExe,
        args: [
          "--processStart",
          `"${exeName}"`,
          "--process-start-args",
          `"--hidden"`,
        ],
      });
    } else {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
      });
    }
    settings.set("autoLaunch", "true");
  }
}
