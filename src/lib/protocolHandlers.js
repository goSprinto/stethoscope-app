/**
 * This module registers all of the internal protocol handlers
 * Most of them are used in practices/instructions.yaml to take the user
 * where they need to go to resolve issue, but are also used by the web app
 * to trigger actions
 * (e.g. app://some-app opens some-app)
 */
import { protocol, shell } from 'electron'
import os from 'os'
import log from './logger'
import applescript from './applescript'
import { MAC, WIN } from './platform'
import updateInit from '../updater'
import * as powershell from './powershell'
import { isTrustedUrl } from './isTrustedUrl'

const env = process.env.STETHOSCOPE_ENV || 'production'

export default function initProtocols (mainWindow) {
  const { checkForUpdates } = updateInit(env, mainWindow)

  // Validate and sanitize URLs before handling
  const validateAndSanitizeUrl = (url, protocol) => {
    try {
      const decodedUrl = decodeURIComponent(url);
      // Remove the protocol prefix for validation
      const urlWithoutProtocol = decodedUrl.replace(`${protocol}://`, '');
      // Basic sanitization - only allow alphanumeric, dots, dashes, and underscores
      return urlWithoutProtocol.replace(/[^\w\-\.\s]/g, '');
    } catch (e) {
      log.error(`Invalid URL format: ${e.message}`);
      return null;
    }
  };

  // used in instructions.yaml
  protocol.registerHttpProtocol('app', (request, cb) => {
    const sanitizedApp = validateAndSanitizeUrl(request.url, 'app');
    if (sanitizedApp) {
      applescript.openApp(sanitizedApp);
    } else {
      log.warn(`Blocked invalid app protocol request: ${request.url}`);
    }
  })

  // used in instructions.yaml
  protocol.registerHttpProtocol('prefs', (request, cb) => {
    const sanitizedPref = validateAndSanitizeUrl(request.url, 'prefs');
    if (!sanitizedPref) {
      log.warn(`Blocked invalid prefs protocol request: ${request.url}`);
      return;
    }

    switch (os.platform()) {
      case MAC:
        applescript.openPreferences(sanitizedPref);
        break;
      case WIN:
        powershell.openPreferences(sanitizedPref);
        break;
      default:
        break;
    }
  })

  // handle 'action://update' links to start Stethoscope update process
  protocol.registerHttpProtocol('action', (request, cb) => {
    const sanitizedAction = validateAndSanitizeUrl(request.url, 'action');
    if (sanitizedAction && sanitizedAction.includes('update')) {
      try {
        checkForUpdates();
      } catch (e) {
        log.error(e);
      }
    } else {
      log.warn(`Blocked invalid action protocol request: ${request.url}`);
    }
  })

  // open a URL in the user's default browser
  protocol.registerHttpProtocol('link', (request, cb) => {
    const url = request.url.replace('link://', '');
    if (isTrustedUrl(url)) {
      shell.openExternal(url);
    } else {
      log.warn(`Blocked untrusted URL in link protocol: ${url}`);
    }
  })

  // Runs powershell script
  protocol.registerHttpProtocol('ps', (request, cb) => {
    const sanitizedScript = validateAndSanitizeUrl(request.url, 'ps');
    if (sanitizedScript) {
      powershell.run(sanitizedScript);
    } else {
      log.warn(`Blocked invalid powershell script request: ${request.url}`);
    }
  })

  // uses the shell `open` command to open item
  protocol.registerHttpProtocol('open', (request, cb) => {
    const sanitizedPath = validateAndSanitizeUrl(request.url, 'open');
    if (sanitizedPath) {
      shell.openItem(sanitizedPath);
    } else {
      log.warn(`Blocked invalid open protocol request: ${request.url}`);
    }
  })
}
