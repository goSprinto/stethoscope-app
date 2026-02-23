import axios from 'axios';
import log from '../lib/logger';
import { createHttpsAgent } from '../lib/initCertificates';

const API_RETRY_ATTEMPTS = 3;
const API_TIMEOUT = 10000; // 10 seconds
const API_RETRY_DELAY = 1000; // 1 second

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Create HTTPS agent that uses OS certificate store
// This ensures we trust certificates from enterprise proxies (Zscaler, etc.)
const httpsAgent = createHttpsAgent();

// Create axios instance with proper certificate handling and timeout
const axiosInstance = axios.create({
  timeout: API_TIMEOUT,
  httpsAgent: httpsAgent,
  // Always validate certificates - NEVER disable!
  validateStatus: (status) => status >= 200 && status < 300,
});

export default class ApiService {
  /**
   * Detect if an error is certificate-related
   * @param {Error} error - The error to check
   * @returns {boolean} True if this is a certificate error
   */
  static isCertificateError(error) {
    const message = (error && error.message) ? error.message.toLowerCase() : '';
    const code = (error && error.code) ? error.code : '';

    const certErrorPatterns = [
      'unable to get local issuer certificate',
      'unable to verify the first certificate',
      'self signed certificate',
      'certificate has expired',
      'cert',
      'ssl',
      'tls',
    ];

    const certErrorCodes = [
      'UNABLE_TO_GET_ISSUER_CERT',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'CERT_HAS_EXPIRED',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    ];

    return certErrorPatterns.some((pattern) => message.includes(pattern)) ||
           certErrorCodes.includes(code);
  }

  static async makeRequest(config, retryCount = 0) {
    try {
      // Axios handles the request with proper certificate validation
      const response = await axiosInstance(config);

      // Axios automatically parses JSON responses
      return response.data;
    } catch (error) {
      // Detect certificate errors and provide helpful context
      if (this.isCertificateError(error)) {
        const certError = new Error('Certificate validation failed');
        certError.code = 'CERT_ERROR';
        certError.originalError = error;
        certError.userMessage =
          'Unable to verify SSL certificate. This may happen if:\n' +
          '1. You are behind a corporate proxy (Zscaler, Cisco, etc.)\n' +
          '2. The proxy\'s root certificate is not installed in your system\n\n' +
          'Action Required:\n' +
          '- Contact your IT department to install the proxy certificate, or\n' +
          '- Set NODE_EXTRA_CA_CERTS environment variable to point to your certificate file\n\n' +
          `Technical details: ${error.message}`;

        log.error('Certificate validation error', {
          message: error.message,
          code: error.code,
          url: config.url,
        });

        throw certError;
      }

      // Handle timeout errors
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        const timeoutError = new Error('Request timeout');
        timeoutError.code = 'ECONNABORTED';
        timeoutError.userMessage =
          'Request timed out after 10 seconds.\n\n' +
          'Possible causes:\n' +
          '- Slow internet connection\n' +
          '- Sprinto servers are unreachable\n' +
          '- Firewall blocking connection\n\n' +
          'Action: Check your internet connection and try again.';
        throw timeoutError;
      }

      // Retry on common transient network errors
      const transientMatches = [
        'getaddrinfo',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ECONNRESET',
      ];

      const message = (error && error.message) ? error.message : '';
      const causeCode = (error && error.cause && error.cause.code) ? error.cause.code : '';
      const errorCode = error.code || '';

      const isTransient = transientMatches.some((s) => message.includes(s)) ||
        transientMatches.includes(causeCode) ||
        transientMatches.includes(errorCode);

      if (retryCount < API_RETRY_ATTEMPTS && isTransient) {
        log.info(`Retrying request (attempt ${retryCount + 1}/${API_RETRY_ATTEMPTS}): ${error.message}`);
        await delay(API_RETRY_DELAY * (retryCount + 1));
        return this.makeRequest(config, retryCount + 1);
      }

      // For HTTP errors, throw with response details and user message
      if (error.response) {
        const httpError = new Error(`HTTP error ${error.response.status}`);
        httpError.response = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        };
        httpError.code = `HTTP_${error.response.status}`;

        // Provide user-friendly messages for common HTTP errors
        if (error.response.status === 401) {
          httpError.userMessage = 'Authentication failed. Please log in again.';
        } else if (error.response.status === 403) {
          httpError.userMessage = 'Access denied. Check your permissions.';
        } else if (error.response.status === 404) {
          httpError.userMessage = 'Service not found. Please contact support.';
        } else if (error.response.status >= 500) {
          httpError.userMessage = 'Server error. Please try again later.';
        } else {
          httpError.userMessage = `Request failed with status ${error.response.status}`;
        }

        throw httpError;
      }

      // Network errors
      if (errorCode === 'ENOTFOUND' || message.includes('getaddrinfo')) {
        const dnsError = new Error('DNS resolution failed');
        dnsError.code = 'DNS_ERROR';
        dnsError.originalError = error;
        dnsError.userMessage =
          'Cannot reach Sprinto servers.\n\n' +
          'Possible causes:\n' +
          '- No internet connection\n' +
          '- DNS resolution failure\n' +
          '- VPN or firewall blocking access\n\n' +
          'Action: Check your network connection and firewall settings.';
        throw dnsError;
      }

      // Re-throw other errors with generic message
      error.userMessage = error.userMessage ||
        `Network error: ${error.message || 'Unknown error'}`;
      throw error;
    }
  }

  static async reportDevice(baseUrl, token, data) {
    try {
      await this.makeRequest({
        method: 'post',
        url: `${baseUrl}/drsprinto/api/v1/reportDevice`,
        data: { data },
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": process.env.USER_AGENT,
        }
      });
    
      return true;
    } catch (err) {
      log.error("services-->api:reportDevice", { 
        err: JSON.stringify({ err }), 
        baseUrl,
        retryCount: err.retryCount
      });
      throw err;
    }
  }

  static async getPolicy(baseUrl, token) {
    try {
      const response = await this.makeRequest({
        method: 'get',
        url: `${baseUrl}/drsprinto/api/v1/policyConfigurationWithDynamicOS`,
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": process.env.USER_AGENT,
        }
      });
      
      return response.policy;
    } catch (err) {
      log.error("services-->api:getPolicy", { 
        err: JSON.stringify({ err }), 
        baseUrl,
        retryCount: err.retryCount
      });
      throw err;
    }
  }
}
