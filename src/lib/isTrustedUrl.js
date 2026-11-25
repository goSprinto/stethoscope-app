// Schemes this app registers itself (see lib/protocolHandlers). Navigation to
// these has to be allowed through so the registered handler can run -- each one
// sanitises its own payload before acting on it.
const APP_PROTOCOLS = ['app:', 'prefs:', 'action:', 'link:', 'ps:', 'open:']

// OS settings schemes used by the remediation instructions. These cannot be
// navigated to; they have to be handed to the OS via shell.openExternal.
const OS_SETTINGS_PROTOCOLS = ['x-apple.systempreferences:', 'ms-settings:']

// settings identifiers are dotted names, optionally with an anchor
// (e.g. com.apple.preference.security?Firewall). Nothing else is accepted, so a
// crafted link cannot smuggle anything past shell.openExternal.
const SETTINGS_PAYLOAD = /^[\w.-]*(\?[\w.-]+)?$/

function protocolOf (urlString) {
  try {
    return new URL(urlString).protocol
  } catch (err) {
    return null
  }
}

// true for a scheme handled by this app's own protocol handlers
export function isAppProtocolUrl (urlString) {
  return APP_PROTOCOLS.includes(protocolOf(urlString))
}

// true for an OS settings deep link with a payload we recognise as safe
export function isOsSettingsUrl (urlString) {
  const protocol = protocolOf(urlString)
  if (!OS_SETTINGS_PROTOCOLS.includes(protocol)) return false
  return SETTINGS_PAYLOAD.test(urlString.slice(protocol.length))
}

// a web page that may be handed to the user's default browser: any https
// URL with no credentials in it. The remediation instructions link to
// vendor sites (avg.com, sophos.com, support.apple.com, ...), which must open
// in the browser, never in an app window that carries the app's Origin
export function isExternalWebUrl (urlString) {
  try {
    const url = new URL(urlString)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch (err) {
    return false
  }
}

// a Sprinto web page: https on sprinto.com or a subdomain, no credentials.
// Such links open in the user's default browser, never in the app window
// (V8-2292). http, localhost and 127.0.0.1 are not trusted: an app window
// has Node access, and plain http can be rewritten on the network
export function isTrustedUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    return url.hostname === 'sprinto.com' || url.hostname.endsWith('.sprinto.com');
  } catch (err) {
    return false;
  }
}

// true when url is the app's own page, the only thing the app window may
// navigate to in place. appUrl is the page the window loads: build/index.html
// over file: in a packaged build, the dev server in development
export function isAppPageUrl(urlString, appUrl) {
  try {
    const url = new URL(urlString);
    const app = new URL(appUrl);
    if (app.protocol === 'file:') {
      return url.protocol === 'file:' && url.pathname === app.pathname;
    }
    return url.origin === app.origin;
  } catch (err) {
    return false;
  }
}

export default isTrustedUrl; 
