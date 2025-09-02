import axios from "axios";

const API_RETRY_ATTEMPTS = 3;
const API_TIMEOUT = 10000; // 10 seconds
const API_RETRY_DELAY = 1000; // 1 second

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
