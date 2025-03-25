export function isTrustedUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // List of allowed protocols
    const allowedProtocols = ['https:', 'http:', 'file:', 'drsprinto:'];
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