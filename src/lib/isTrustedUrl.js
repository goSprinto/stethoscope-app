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

export function isTrustedUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // List of allowed protocols
    const allowedProtocols = ['https:', 'http:', 'drsprinto:'];
    if (!allowedProtocols.includes(url.protocol)) {
      return false;
    }

    // List of allowed domains
    const allowedDomains = ['sprinto.com', 'localhost', '127.0.0.1'];
    return allowedDomains.some(domain => 
      url.hostname === domain || url.hostname.endsWith(`.${domain}`)
    );
  } catch (err) {
    console.error('Invalid URL:', err);
    return false;
  }
}

export default isTrustedUrl; 
