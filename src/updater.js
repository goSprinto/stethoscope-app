import { dialog, app } from 'electron'
import { autoUpdater } from 'electron-updater'
import config from './config'

let attemptingUpdate = false
let isFirstLaunch
let forceUpdate = false
const eventRegistration = {}

// NOTE:
// The actual updating only happens in prod - electron updates (due to Squirrel)
// must be signed, so the process always fails in dev
export default function updater (env, mainWindow, log = console, server, focusOrCreateWindow) {
  autoUpdater.autoDownload = false
  if (config.allowPrerelease) {
    autoUpdater.allowPrerelease = true
  }

  const isDev = env === 'development'

  const eventHandlers = {
    error: error => {
      // first launch, don't show network errors
      if (isFirstLaunch) return

      let err = (isDev ? error.stack : error.message).toString()
      if (error.message.includes('ERR_CONNECTION_REFUSED')) {
        err = 'Update server unavailable'
      }

      if (attemptingUpdate) {
        dialog.showErrorBox('Error Updating: ', error ? err : 'unknown')
        attemptingUpdate = false
      }
    },
    'update-available': () => {
      if (!forceUpdate) {
        dialog.showMessageBox({
          type: 'info',
          title: `${app.name} Update Available`,
          message: `A new version of ${app.name} is available, would you like to download and update now?`,
          buttons: ['Yes', 'No'],
          defaultId: 0
        }).then(({ response }) => {
          if (response === 0) {
            if (!isDev) {
              mainWindow = focusOrCreateWindow(mainWindow)
              autoUpdater.downloadUpdate()
            } else {
              attemptingUpdate = false
              dialog.showMessageBox({
                title: `Downloading ${app.name}`,
                message: 'App cannot be updated in dev mode'
              })
            }
          }
        })
      } else {
        mainWindow = focusOrCreateWindow(mainWindow)
        autoUpdater.downloadUpdate()
      }
    },
    'update-not-available': () => {
      // no need to show the dialog on first launch
      if (isFirstLaunch) return

      dialog.showMessageBox({
        title: `No ${app.name} Updates`,
        message: `You already have the latest version of ${app.name}.`
      })

      attemptingUpdate = false
    },
    'update-downloaded': () => {
      if (!forceUpdate) {
        dialog.showMessageBox({
          title: `Install ${app.name} Updates`,
          message: `Updates downloaded, ${app.name} will quit and relaunch.`
        }).then(() => {
          if (!isDev) {
            if (server && server.listening) {
              server.close()
            }
            setImmediate(() => autoUpdater.quitAndInstall())
          }
        })
      } else {
        if (server && server.listening) {
          server.close()
        }
        setImmediate(() => autoUpdater.quitAndInstall())
      }
    },
    // TODO move this to ipc, remove mainWindow dependency
    'download-progress': (progressObj) => {
      if (mainWindow) {
        mainWindow.webContents.send('download:progress', progressObj)
        // NOTE: uncomment to have download update progress displayed over app icon
        // mainWindow.setProgressBar(progressObj.percent / 100)
      }
    }
  }

  for (const eventName in eventHandlers) {
    // prevent from being registered multiple times
    if (!(eventName in eventRegistration)) {
      eventRegistration[eventName] = true
      autoUpdater.on(eventName, eventHandlers[eventName])
    }
  }

  return {
    forceUpdate () {
      forceUpdate = true
      autoUpdater.checkForUpdates().catch(err => {
        log.error(`Error updating: ${err.message}`, err)
      })
    },
    checkForUpdates (menuItem = {}, focusedWindow = {}, event = {}, isLaunch = false) {
      // don't allow multiple concurrent attempts
      attemptingUpdate = true
      isFirstLaunch = isLaunch

      return autoUpdater.checkForUpdates().catch(err => {
        log.error('Error updating', err)
        isFirstLaunch = false
      })
    }
  }
}
