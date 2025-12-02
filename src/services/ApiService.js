const API_RETRY_ATTEMPTS = 3;
const API_TIMEOUT = 10000; // 10 seconds
const API_RETRY_DELAY = 1000; // 1 second

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default class ApiService {
  static async makeRequest(config, retryCount = 0) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    try {
      const { method = 'get', url, data, headers } = config || {};

      const fetchOptions = {
        method: method.toUpperCase(),
        headers: headers ? { ...headers } : undefined,
        signal: controller.signal,
      };

      const lowerMethod = method.toLowerCase();
      if (data !== undefined && lowerMethod !== 'get' && lowerMethod !== 'head') {
        if (!fetchOptions.headers) fetchOptions.headers = {};

        const hasContentTypeHeader = Object.keys(fetchOptions.headers)
          .some((h) => h.toLowerCase() === 'content-type');

        fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data);
        if (!hasContentTypeHeader && typeof fetchOptions.body === 'string') {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      }

      const res = await fetch(url, fetchOptions);

      if (!res.ok) {
        let responseText = '';
        try {
          responseText = await res.text();
        } catch (_) {}

        let parsed;
        try {
          parsed = responseText ? JSON.parse(responseText) : undefined;
        } catch (_) {
          parsed = responseText;
        }

        const httpError = new Error(`HTTP error ${res.status}`);
        httpError.response = {
          status: res.status,
          statusText: res.statusText,
          data: parsed,
        };
        throw httpError;
      }

      const contentType = res.headers.get('content-type') || '';
      let responseData;
      if (contentType.includes('application/json')) {
        responseData = await res.json();
      } else {
        let text = '';
        try {
          text = await res.text();
        } catch (_) {}
        try {
          responseData = text ? JSON.parse(text) : undefined;
        } catch (_) {
          responseData = text;
        }
      }

      return responseData;
    } catch (error) {
      // Normalize timeout errors
      if (error && (error.name === 'AbortError')) {
        error.code = 'ECONNABORTED';
      }

      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      }

      // Retry on common transient network errors
      const transientMatches = [
        'getaddrinfo',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
      ];

      const message = (error && error.message) ? error.message : '';
      const causeCode = (error && error.cause && error.cause.code) ? error.cause.code : '';

      const isTransient = transientMatches.some((s) => message.includes(s)) ||
        transientMatches.includes(causeCode) ||
        error.code === 'ECONNABORTED';

      if (retryCount < API_RETRY_ATTEMPTS && isTransient) {
        await delay(API_RETRY_DELAY * (retryCount + 1));
        return this.makeRequest(config, retryCount + 1);
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
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
