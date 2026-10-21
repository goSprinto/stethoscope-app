import axios from "axios";

const API_RETRY_ATTEMPTS = 3;
const API_TIMEOUT = 10000; // 10 seconds
const API_RETRY_DELAY = 1000; // 1 second

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Logging the raw AxiosError would write the Authorization header to disk, so keep only what explains the failure.
const describeError = (err) => {
  const response = err?.response;
  const body = response?.data;
  return {
    message: err?.message,
    code: err?.code,
    status: response?.status,
    responseBody: typeof body === "string" ? body.slice(0, 500) : body,
    server: response?.headers?.server,
    contentType: response?.headers?.["content-type"],
    cloudfrontRequestId: response?.headers?.["x-amz-cf-id"],
  };
};

export default class ApiService {
  static async makeRequest(config, retryCount = 0) {
    try {
      const response = await axios({
        ...config,
        timeout: API_TIMEOUT,
      });
      return response.data;
    } catch (error) {
      // Handle specific error types
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      }

      if (
        retryCount < API_RETRY_ATTEMPTS && 
        (
          error.message.includes('getaddrinfo') ||
          error.message.includes('ENOTFOUND') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.code === 'ECONNABORTED'
        )
      ) {
        await delay(API_RETRY_DELAY * (retryCount + 1));
        return this.makeRequest(config, retryCount + 1);
      }

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
        err: describeError(err),
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
        err: describeError(err),
        baseUrl,
        retryCount: err.retryCount
      });
      throw err;
    }
  }

  static async reportDiscoveredVendors(baseUrl, token, discoveredVendors) {
    try {
      await this.makeRequest({
        method: 'post',
        url: `${baseUrl}/drsprinto/api/v1/reportDiscoveredVendors`,
        data: { data: { discoveredVendors } },
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": process.env.USER_AGENT,
        }
      });

      log.info("services-->api:reportDiscoveredVendors", {
        baseUrl,
        count: discoveredVendors.length,
      });
      return true;
    } catch (err) {
      log.error("services-->api:reportDiscoveredVendors", {
        err: describeError(err),
        baseUrl,
        count: discoveredVendors?.length,
        retryCount: err.retryCount
      });
      throw err;
    }
  }
}
