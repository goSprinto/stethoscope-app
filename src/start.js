/**
 * main entry point for the electron app. This file configures and initializes
 * the entire application which includes:
 *  - Handle launch/deeplink events
 *  - Initialize custom protocols used within the app (e.g. app://foo, ps://bar)
 *  - Initialize auto launch behavior
 *  - Create the BrowserWindow (stored as global.app for use throughout the app)
 *  - initialize app menus and dock/tray behavior
 *  - Start the GraphQL (express) server
 *  - handle server triggered events (e.g. changing app icon based on policy result)
 *  - Handle uncaught exceptions in any part of the app
 *  - Handle IPC calls from other parts of the application
 *    - 'scan:init' - Automatic update triggered (resizes app, displays progress)
 *    - 'app:loaded' - Notify when client side app is loaded
 *    - 'download:completed' - update has finished downloading
 */
import path from "path";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeImage,
  session,
  Tray,
  shell,
} from "electron";
import url from "url";
import log from "./lib/logger";
import initMenu from "./Menu";
import config from "./config.json";
import { MINIMUM_AUTOSCAN_INTERVAL_SECONDS } from "./constants";
// import settings from 'electron-settings'
import Store from "electron-store";
import initProtocols from "./lib/protocolHandlers";
// import loadReactDevTools from "./lib/loadReactDevTools";
import iconFinder from "./lib/findIcon";
import startGraphQLServer from "./server";
import { IS_MAC, IS_WIN } from "./lib/platform";
import AutoLauncher from "./AutoLauncher";
import updateInit from "./updater";
import AuthService from "./services/AuthService";
import ApiService from "./services/ApiService";
import verifyConnection from "./lib/verifyConnection";
import { sprintoApiBaseUrl } from "./lib/originCheck";
import { parseDeepLink, deepLinkFromArgv } from "./lib/deepLink";
import {
  isAppPageUrl,
  isAppProtocolUrl,
  isOsSettingsUrl,
  isExternalWebUrl,
} from "./lib/isTrustedUrl";
import applescript from "./lib/applescript";
import unixify from "unixify";

const MAC_SETTINGS_SCHEME = "x-apple.systempreferences:";

// Hand an OS settings deep link to the operating system. On macOS the pane id
// goes through openPreferences, which maps the legacy System Preferences ids
// still used in instructions.en.yaml onto their System Settings equivalents;
// without that, macOS 13+ opens Settings on whatever pane was last shown.
const openOsSettingsUrl = (navigationUrl) => {
  if (navigationUrl.startsWith(MAC_SETTINGS_SCHEME)) {
    return applescript.openPreferences(
      navigationUrl.slice(MAC_SETTINGS_SCHEME.length)
    );
  }
  return shell.openExternal(navigationUrl);
};

app.disableHardwareAcceleration();

const remoteMain = require("@electron/remote/main");
remoteMain.initialize();


// Protect against RPATH-based shared object hijacking on Linux
if (process.platform === "linux") {
  // Use absolute paths for libraries
  const absoluteLibPath = path.resolve(app.getAppPath(), "lib");
  // Set DT_RUNPATH instead of DT_RPATH
  process.env.LD_RUN_PATH = absoluteLibPath;
  app.commandLine.appendSwitch('no-sandbox');
}

const settings = new Store({ name: "settings" });

const env = process.env.STETHOSCOPE_ENV || "production";
const findIcon = iconFinder(env);
const IS_DEV = env === "development";
const IS_TEST = !!process.argv.find((arg) => arg.includes("testMode"));
const disableAutomaticScanning = settings.get("disableAutomaticScanning");

let mainWindow;
let tray;
const appStartTime = Date.now();
let server;
let updater;
// a drsprinto:// link that arrived before the app was ready (on Windows, the
// one the app was launched with); handled once the window exists
let pendingDeepLink = deepLinkFromArgv(process.argv);
let isLaunching = true;
let isFirstLaunch = false;
// icons that are displayed in the Menu bar
const statusImages = {
  PASS: nativeImage.createFromPath(
    findIcon("drsprinto-icons/drsprinto-icon-ok@2x.png")
  ),
  NUDGE: nativeImage.createFromPath(
    findIcon("drsprinto-icons/drsprinto-icon-nudge@2x.png")
  ),
  FAIL: nativeImage.createFromPath(
    findIcon("drsprinto-icons/drsprinto-icon-warn@2x.png")
  ),
};

const windowPrefs = {
  width: 520,
  height: 700,
  fullscreenable: false,
  maximizable: false,
  autoHideMenuBar: true,
  skipTaskbar: true,
  show: true,
  webPreferences: {
    nodeIntegration: true,
    webSecurity: false,
    contextIsolation: false,
    sandbox: false,
    media: false,
    enableRemoteModule: false,
  },
};

// use build/ assets in production, webpack HMR server in dev
const BASE_URL =
  process.env.ELECTRON_START_URL ||
  url.format({
    pathname: path.join(__dirname, "/../build/index.html"),
    protocol: "file:",
    slashes: true,
  });

// process command line arguments
// only the exact flag: on Windows a drsprinto:// link arrives as an argument
// too, and drsprinto://enableDebugger used to match (V8-2293)
let enableDebugger = process.argv.some((arg) =>
  ["--enableDebugger", "enableDebugger"].includes(arg)
);
const DEBUG_MODE = !!process.env.STETHOSCOPE_DEBUG;


// navigation security controls, applied to every BrowserWindow the app creates
const addNavigationControls = (win) => {
  // the window runs with Node access, so it only ever shows the app's own
  // page. Every web page, Sprinto's included, opens in the default browser
  // (V8-2292); before, *.sprinto.com over http or https and localhost on any
  // port loaded in place and got Node access and the app's Origin
  const guardNavigation = (event, navigationUrl) => {
    if (isAppPageUrl(navigationUrl, BASE_URL)) return;

    // app://, prefs://, ps:// and friends are registered in lib/protocolHandlers
    // and sanitise their own payload; blocking them here would stop the handler
    // from ever running
    if (isAppProtocolUrl(navigationUrl)) return;

    // anything else must not navigate the window
    event.preventDefault();

    if (isOsSettingsUrl(navigationUrl)) {
      openOsSettingsUrl(navigationUrl);
      return;
    }

    // https pages open in the browser; http is never opened
    if (isExternalWebUrl(navigationUrl)) {
      shell.openExternal(navigationUrl);
      return;
    }

    log.warn(`Blocked navigation to: ${navigationUrl}`);
  };
  win.webContents.on("will-navigate", guardNavigation);
  // a redirect, e.g. from an open redirect on an allowed page, gets the same
  // check: will-navigate only sees the first URL
  win.webContents.on("will-redirect", guardNavigation);

  // window.open / target="_blank" links. The old "new-window" event was
  // removed in Electron 22, so it no longer fired at all on current Electron
  win.webContents.setWindowOpenHandler(({ url: navigationUrl }) => {
    // links open in the default browser, outside the app session, so the
    // page never gets the app's drsprinto://main Origin (V8-2210)
    if (isExternalWebUrl(navigationUrl)) {
      shell.openExternal(navigationUrl);
    } else if (isOsSettingsUrl(navigationUrl)) {
      openOsSettingsUrl(navigationUrl);
    } else {
      log.warn(`Blocked new window to: ${navigationUrl}`);
    }
    // never open a new Electron window
    return { action: "deny" };
  });
};

const focusOrCreateWindow = (mainWindow) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
      return mainWindow;
    }
    mainWindow.show();
  } else {
    mainWindow = new BrowserWindow(windowPrefs);
    remoteMain.enable(mainWindow.webContents);
    addNavigationControls(mainWindow);
    initMenu(mainWindow, app, focusOrCreateWindow, updater, log);
    mainWindow.loadURL(BASE_URL);
  }
  return mainWindow;
};

async function createWindow(show = true) {
  // used to show initial launch messages to user
  if (!settings.has("userHasLaunchedApp")) {
    isFirstLaunch = true;
    settings.set("userHasLaunchedApp", true);
  }
  windowPrefs.show = show;
  // wait for process to load before hiding in dock, prevents the app
  // from flashing into view and then hiding
  if (!IS_DEV && IS_MAC) setImmediate(() => app.dock.hide());
  // only allow resize if debugging production build
  if (!IS_DEV && !enableDebugger) windowPrefs.resizable = false;

  mainWindow = new BrowserWindow(windowPrefs);
  remoteMain.enable(mainWindow.webContents);
  addNavigationControls(mainWindow);

  // if (IS_DEV) loadReactDevTools(BrowserWindow);
  // open developer console if env vars or args request
  if (enableDebugger || DEBUG_MODE) {
    mainWindow.webContents.openDevTools();
  }
  // to prevent the app from being throttled when in the background
  mainWindow.webContents.setBackgroundThrottling(false);

  // required at run time so dependencies can be injected
  updater = updateInit(env, mainWindow, log, server, focusOrCreateWindow);

  if (isLaunching) {
    updater.checkForUpdates({}, {}, {}, true);
    // check for updates in background
    const EVERY_DAY = 86400 * 1000;
    setInterval(() => updater.checkForUpdates({}, {}, {}, true), EVERY_DAY);
    isLaunching = false;
  }

  if (isFirstLaunch && !IS_TEST) {
    dialog
      .showMessageBox({
        type: "info",
        title: "Auto Launch",
        message:
          "Would you like to automatically launch DrSprinto on start-up?",
        buttons: ["Yes", "No"],
      })
      .then(({ response }) => {
        const autoLauncher = new AutoLauncher(app, app.name);
        if (response === 0) {
          autoLauncher.enable(app);
          // handling for windows or mac Os
        } else {
          autoLauncher.disable(app);
        }
      });
    isLaunching = false;
  }

  if (tray) tray.destroy();

  tray = new Tray(statusImages.PASS);
  tray.setContextMenu(
    initMenu(mainWindow, app, focusOrCreateWindow, updater, log)
  );

  tray.on("click", () => {
    mainWindow = focusOrCreateWindow(mainWindow);
  });

  tray.on("right-click", () => tray.popUpContextMenu());

  // these methods allow express to update app state
  const appHooksForServer = {
    setScanStatus(status = "PASS") {
      let next = statusImages.PASS;
      if (status in statusImages) {
        next = statusImages[status];
      }
      tray.setImage(next);
    },
    requestUpdate() {
      updater.checkForUpdates();
    },
    enableDebugger: enableAppDebugger,
    // resolves when the user agrees, rejects otherwise
    confirmConnect({ host, firstName }) {
      const who = firstName ? ` as ${firstName}` : "";
      return confirmDialog({
        title: "Connect Device",
        message: `Connect ${app.name} to Sprinto${who}?`,
        detail: `This device will send its security status to ${host}. If you didn't start this from Sprinto, choose Cancel.`,
        confirmLabel: "Connect",
      });
    },
    // checks the token from /connect with Sprinto by fetching the policy
    // with it (V8-2208); never rejects
    verifyConnection({ accessToken, baseUrl }) {
      return verifyConnection(
        (url, token) => ApiService.getPolicy(url, token),
        baseUrl,
        accessToken
      );
    },
    // tells the user a connect didn't go through, so they start it again
    showConnectError(reason) {
      const detail =
        reason === "rejected"
          ? "Sprinto didn't accept this connection. Go back to Sprinto and connect this device again."
          : "Sprinto couldn't be reached. Check your internet connection, then go back to Sprinto and connect this device again.";
      askUser({
        type: "error",
        title: "Connect Device",
        message: `${app.name} couldn't connect to Sprinto`,
        detail,
        buttons: ["OK"],
      }).catch((err) => log.error(`connect error dialog: ${err.message}`));
    },
    confirmDisconnect(origin) {
      return confirmDialog({
        title: "Disconnect Device",
        message: `Disconnect ${app.name} from Sprinto?`,
        detail: `Requested by ${origin || "an unknown caller"}. This device will stop reporting its security status.`,
        confirmLabel: "Disconnect",
      });
    },
    // /raw from anything but the app (V8-2294); resolves when the user agrees
    requestDeviceDataPermission(origin) {
      return confirmDialog({
        title: "Share Device Details",
        message: `Share this device's details with ${origin}?`,
        detail:
          "This includes the operating system, disk encryption, firewall, installed apps and running processes. If you didn't expect this, choose Cancel.",
        confirmLabel: "Share",
      });
    },
    requestLogPermission(origin) {
      return askUser({
        type: "info",
        title: "Allow Access",
        message: `Will you allow your Stethoscope log files to be sent to ${origin}?`,
        buttons: ["Yes", "No"],
        defaultId: 1,
        cancelId: 1,
      }).then((response) => {
        if (response !== 0) throw new Error("Access denied");
      });
    },
  };

  // used to select the appropriate instructions file
  const [language] = app.getLocale().split("-");
  // start GraphQL server, close the app if 37370 is already in use
  server = await startGraphQLServer(env, log, language, appHooksForServer);
  // createWindow runs again when the window has been destroyed, and the
  // server object is reused; drop the previous run's listeners so each event
  // is handled once
  server.removeAllListeners("error");
  server.removeAllListeners("server:ready");
  server.on("error", (error) => {
    const e = new Error(error);
    log.info(`startup:express:error ${JSON.stringify(e)}`);
    if (error.message.includes("EADDRINUSE")) {
      dialog.showMessageBox({
        message: "Something is already using port 37370",
      });
    }
  });

  server.on("server:ready", () => {
    if (!mainWindow) {
      mainWindow = new BrowserWindow(windowPrefs);
      remoteMain.enable(mainWindow.webContents);
      addNavigationControls(mainWindow);
    }
    mainWindow.loadURL(BASE_URL);
    mainWindow.focus();
  });

  // same for IPC handlers: without this a re-created window registered a
  // second "scan:init" handler, scheduling two automatic scans at a time
  [
    "contextmenu",
    "app:restart",
    "download:start",
    "scan:init",
    "download:complete",
    "app:loaded",
  ].forEach((channel) => ipcMain.removeAllListeners(channel));

  // add right-click menu to app
  ipcMain.on("contextmenu", (event) =>
    initMenu(mainWindow, app, focusOrCreateWindow, updater, log).popup({
      window: mainWindow,
    })
  );

  // allow web app to restart application
  ipcMain.on("app:restart", () => {
    if (server && server.listening) {
      server.close();
    }
    app.relaunch();
    app.quit();
  });

  // adjust window height when download begins and ends
  ipcMain.on(
    "download:start",
    () => mainWindow && mainWindow.setSize(windowPrefs.width, 110, true)
  );

  // holds the setTimeout handle
  let rescanTimeout;
  const { rescanIntervalSeconds = MINIMUM_AUTOSCAN_INTERVAL_SECONDS } = config;
  // ensure minimum delay is 5 minutes
  const scanSeconds = Math.max(
    MINIMUM_AUTOSCAN_INTERVAL_SECONDS,
    rescanIntervalSeconds
  );
  const rescanDelay = scanSeconds * 1000;

  ipcMain.on("scan:init", (event) => {
    // schedule next automatic scan
    try {
      clearTimeout(rescanTimeout);
      rescanTimeout = setTimeout(async () => {
        if (event.sender.isDestroyed()) {
          console.log(
            "doing auto reporting - object destroyed?...creating object again"
          );
          server.close(() => {
            console.log("Server closed");
          });
          await createWindow(false);
        } else if (event && event.sender && !event.sender.isDestroyed()) {
          console.log("Started auto reporting - object not destroyed");
          try {
            // the server stays up between scans; bring it back only if it
            // has stopped listening (it used to be closed and restarted on
            // every automatic scan)
            if (!server || !server.listening) {
              server = await startGraphQLServer(
                env,
                log,
                language,
                appHooksForServer
              );
            }

            event.sender.send("autoscan:start", {
              notificationOnViolation: true,
            });
          } catch (e) {
            log.error("start:[WARN] unable to run autoscan", e.message);
          }
        }
      }, rescanDelay);
    } catch (error) {
      console.log("clearTimeout:: error", error);
    }
  });

  // restore main window after update is downloaded (if arg = { resize: true })
  ipcMain.on("download:complete", (event, arg) => {
    if (arg && arg.resize && mainWindow) {
      mainWindow.setSize(windowPrefs.width, windowPrefs.height, true);
    }
  });

  if (mainWindow) {
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }
}

// asks the user on behalf of a caller of the local API. The app usually runs
// from the tray with its window hidden, so the window is shown and brought to
// the front first and the dialog is attached to it: a sheet on a hidden
// window is never seen, and on macOS a dialog with no parent runs
// synchronously, blocking the main process (and this API) until answered.
// The dialog closes itself (as Cancel) after ASK_TIMEOUT_MS so the caller is
// never left waiting
const ASK_TIMEOUT_MS = 2 * 60 * 1000;

function askUser(options) {
  mainWindow = focusOrCreateWindow(mainWindow);
  app.focus(IS_MAC ? { steal: true } : undefined);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASK_TIMEOUT_MS);
  return dialog
    .showMessageBox(mainWindow, { noLink: true, ...options, signal: controller.signal })
    .then(({ response }) => response)
    .finally(() => clearTimeout(timer));
}

function confirmDialog({ title, message, detail, confirmLabel }) {
  return askUser({
    type: "question",
    title,
    message,
    detail,
    buttons: [confirmLabel, "Cancel"],
    defaultId: 1,
    cancelId: 1,
  }).then((response) => {
    if (response !== 0) throw new Error("Declined");
  });
}

// the token only ever goes to a Sprinto regional host, whatever is stored
// in settings (an older build may have saved another URL from /connect)
function checkedBaseUrl(baseUrl, caller) {
  const isDev = process.env.STETHOSCOPE_ENV === "development";
  const checked = sprintoApiBaseUrl(baseUrl, { isDev });
  if (!checked) {
    log.error(`${caller} - refused to send the token to ${baseUrl}`);
  }
  return checked;
}

// acts on a drsprinto:// link (V8-2293). Any web page can open one, so only
// exact link names count, an update goes through the normal prompts, and
// DevTools opens only after the user agrees
function handleDeepLink(link) {
  const action = parseDeepLink(link);
  if (!action) return;
  if (!app.isReady() || !updater) {
    pendingDeepLink = link;
    return;
  }
  log.info(`deep link: ${action}`);

  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }

  if (action === "update") {
    // asks before downloading and before installing; the link used to call
    // forceUpdate, which did both without asking
    updater.checkForUpdates().catch((err) => {
      log.error(`deep link: check for updates failed: ${err}`);
    });
  } else if (action === "debugger") {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow();
    confirmDialog({
      title: "Developer Tools",
      message: `Open developer tools for ${app.name}?`,
      detail:
        "Only do this if Sprinto support asked you to. Developer tools give full access to the app and to this device's Sprinto connection.",
      confirmLabel: "Open",
    }).then(
      () => enableAppDebugger(),
      () => log.info("deep link: developer tools declined")
    );
  }
}

function enableAppDebugger() {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
    mainWindow.setResizable(true);
  }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    // on Windows and Linux a drsprinto:// link opened while the app runs
    // arrives here, as an argument
    const link = deepLinkFromArgv(commandLine);
    if (link) {
      handleDeepLink(link);
      return;
    }

    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // wrap ready callback in 0-delay setTimeout to reduce serious jank
  // issues on Windows
  app.on("ready", () =>
    setTimeout(() => {
      createWindow();
      initProtocols(mainWindow);

      // override internal request origin to give express CORS policy something to check
      session.defaultSession.webRequest.onBeforeSendHeaders(
        (details, callback) => {
          const { requestHeaders } = details;
          const base = "drsprinto://main";
          Object.assign(requestHeaders, {
            Origin: base,
            Referrer: base,
          });
          const args = { cancel: false, requestHeaders };
          callback(args);
        }
      );

      session.defaultSession.webRequest.onHeadersReceived(
        (details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              "Content-Security-Policy": ["script-src 'self' 'unsafe-eval'"],
            },
          });
        }
      );

      session.defaultSession.setPermissionRequestHandler(
        (webContents, permission, callback) => {
          console.log("permission", permission);
          // every request must be answered: an unanswered one stays pending
          // forever. Only notifications are used (the "Security
          // recommendation" alert in App.js); geolocation, media and
          // anything else are denied
          callback(permission === "notifications");
        }
      );

      // a link the app was launched with (Windows), or one that arrived
      // before it was ready (macOS)
      if (pendingDeepLink) {
        const link = pendingDeepLink;
        pendingDeepLink = null;
        handleDeepLink(link);
      }
    }, 0)
  );
}

app.on("before-quit", () => {
  const appCloseTime = Date.now();

  log.debug(`uptime: ${appCloseTime - appStartTime}`);
  if (server && server.listening) {
    server.close();
  }
});

// macOS delivers drsprinto:// links here, before or after the app is ready
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

process.on("uncaughtException", (err) => {
  if (server && server.listening) {
    server.close();
  }
  log.error("exiting on uncaught exception");
  log.error(err.message);
  log.error(err.stack);
  process.exit(1);
});

app.on("window-all-closed", () => {
  // minimize to tray
});

ipcMain.on("get:env:basePath", (event, arg) => {
  const dev = process.env.STETHOSCOPE_ENV === "development";
  event.returnValue = unixify(
    `${dev ? "." : process.resourcesPath}/src/practices`
  );
});

ipcMain.on("get:env:isDev", (event, arg) => {
  event.returnValue = process.env.STETHOSCOPE_ENV === "development";
});

ipcMain.on("get:app:name", (event, arg) => {
  event.returnValue = app.name;
});

// Auth related ops
ipcMain.on("auth:storeToken", (event, token) => {
  try {
    AuthService.storeAccessToken(token);
    event.returnValue = true;
  } catch (err) {
    log.error("auth:storeToken crash", err);
  }
});

ipcMain.on("auth:logout", (event) => {
  try {
    AuthService.logout();
    event.returnValue = true;
  } catch (err) {
    log.error("auth:logout crash", err);
  }
});

// External API calls
// `handle`, not `on`: this makes a network request, and a sendSync caller
// would block the renderer for its entire duration -- up to 46s once the
// request timeout and retries are accounted for.
ipcMain.handle("api:getPolicy", async (event, baseUrl) => {
  // Get latest policy json from sprinto
  try {
    const isDev = process.env.STETHOSCOPE_ENV === "development";
    const token = AuthService.getAccessToken();
    if (token === null || token === undefined) {
      log.error(
        "api:getPolicy - critical should not call this api when token is empty or not connected"
      );
      return false;
    }

    const apiBaseUrl = checkedBaseUrl(baseUrl, "api:getPolicy");
    if (!apiBaseUrl) return null;
    return await ApiService.getPolicy(apiBaseUrl, token, isDev);
  } catch (err) {
    return null;
  }
});

ipcMain.handle("api:reportDevice", async (event, result, device, baseUrl) => {
  try {
    const isDev = process.env.STETHOSCOPE_ENV === "development";
    const token = AuthService.getAccessToken();
    if (token === null || token === undefined) {
      log.error(
        "api:reportDevice - critical should not call this api when token is empty or not connected"
      );
      return false;
    }
    const data = { ...result, device };
    const apiBaseUrl = checkedBaseUrl(baseUrl, "api:reportDevice");
    if (!apiBaseUrl) return false;
    await ApiService.reportDevice(apiBaseUrl, token, data, isDev);
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.on("app:reload", () => {
  if (mainWindow) {
    mainWindow.reload();
  } else {
    mainWindow = focusOrCreateWindow(mainWindow);
  }
});


export {};
