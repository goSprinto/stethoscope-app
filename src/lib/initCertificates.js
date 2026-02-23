import https from 'https';
import fs from 'fs';

let certificatesLoaded = false;
let customCAs = [];
let certificateLoadStatus = {
  success: true,
  errors: [],
  warnings: [],
};

/**
 * Initialize system certificates from OS trust store
 * This allows Node.js to trust certificates installed by enterprise proxies
 * (Zscaler, Cisco Umbrella, McAfee, etc.) without requiring app-specific configuration
 *
 * @param {Object} log - Logger instance
 * @returns {Array} Array of custom CA certificates loaded
 */
export function initializeSystemCertificates(log) {
  if (certificatesLoaded) {
    log.info('System certificates already initialized');
    return certificateLoadStatus;
  }

  try {
    // Windows: Load from Windows Certificate Store
    // This handles Zscaler and other enterprise proxies automatically
    if (process.platform === 'win32') {
      try {
        const winCA = require('win-ca');
        // '+' mode means append to existing CAs, don't replace
        // This ensures we still trust public CAs (Let's Encrypt, DigiCert, etc.)
        winCA.inject('+');
        log.info('Windows system certificates loaded from Windows Certificate Store');
        certificateLoadStatus.warnings.push('Windows certificates loaded successfully');
      } catch (err) {
        const warning = `Failed to load Windows certificates: ${err.message}`;
        log.warn(warning);
        certificateLoadStatus.warnings.push(warning);
        certificateLoadStatus.success = false;

        // This is critical on Windows - if win-ca fails, certificate errors are likely
        log.warn(
          'IMPORTANT: If you encounter certificate errors, ensure win-ca package is installed. ' +
          'Corporate proxy users should verify proxy certificates are installed in Windows Certificate Store.'
        );
      }
    }

    // macOS: Load from System Keychain
    if (process.platform === 'darwin') {
      try {
        const macCA = require('mac-ca');
        // Adds macOS keychain certificates to https.globalAgent
        macCA.addToGlobalAgent();
        log.info('macOS system certificates loaded from Keychain');
        certificateLoadStatus.warnings.push('macOS certificates loaded successfully');
      } catch (err) {
        const warning = `Failed to load macOS certificates: ${err.message}`;
        log.warn(warning);
        certificateLoadStatus.warnings.push(warning);
        certificateLoadStatus.success = false;
      }
    }

    // Linux: Use OpenSSL default CA bundle
    // Most Linux distributions already configure Node to use system certs
    if (process.platform === 'linux') {
      log.info('Using Linux system CA bundle (OpenSSL defaults)');
      certificateLoadStatus.warnings.push('Using Linux OpenSSL CA bundle');
      // For Linux, we rely on --use-openssl-ca flag or system defaults
      // Most package managers configure this correctly
    }

    // Support NODE_EXTRA_CA_CERTS environment variable
    // This allows customers to provide additional certificates without admin access
    // Usage: set NODE_EXTRA_CA_CERTS=C:\path\to\custom-ca.pem
    if (process.env.NODE_EXTRA_CA_CERTS) {
      try {
        const extraCertPath = process.env.NODE_EXTRA_CA_CERTS;
        const extraCerts = fs.readFileSync(extraCertPath, 'utf8');
        customCAs.push(extraCerts);

        // Add to https.globalAgent so all requests use these certs
        if (!https.globalAgent.options) {
          https.globalAgent.options = {};
        }
        if (!https.globalAgent.options.ca) {
          https.globalAgent.options.ca = [];
        }
        https.globalAgent.options.ca.push(extraCerts);

        log.info(`Loaded additional certificates from NODE_EXTRA_CA_CERTS: ${extraCertPath}`);
        certificateLoadStatus.warnings.push(`Loaded custom certificates from ${extraCertPath}`);
      } catch (err) {
        const warning = `Failed to load NODE_EXTRA_CA_CERTS from ${process.env.NODE_EXTRA_CA_CERTS}: ${err.message}`;
        log.warn(warning);
        certificateLoadStatus.warnings.push(warning);
      }
    }

    certificatesLoaded = true;
    log.info('Certificate initialization complete');
    return certificateLoadStatus;
  } catch (err) {
    log.error(`Certificate initialization error: ${err.message}`);
    log.error(err.stack);
    certificateLoadStatus.success = false;
    certificateLoadStatus.errors.push(`Fatal error: ${err.message}`);
    return certificateLoadStatus;
  }
}

/**
 * Get the certificate loading status
 * @returns {Object} Status object with success, errors, and warnings
 */
export function getCertificateStatus() {
  return certificateLoadStatus;
}

/**
 * Create an HTTPS agent configured to use system certificates
 * This agent should be used for all outbound HTTPS requests
 *
 * @returns {https.Agent} Configured HTTPS agent
 */
export function createHttpsAgent() {
  // Create an HTTPS agent that uses the system certificates
  // win-ca and mac-ca have already injected certificates into https.globalAgent
  return new https.Agent({
    // CRITICAL: Always validate certificates - NEVER set to false!
    rejectUnauthorized: true,
    // The agent will use certificates from https.globalAgent.options.ca
    // which now includes OS certificates thanks to win-ca/mac-ca
  });
}
