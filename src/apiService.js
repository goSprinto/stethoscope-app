import axios from "axios";
import appConfig from "./config.json";

export default class ApiService {
  static async reportDevice(token, data, isDev) {
    const baseUrl = isDev ? "http://localhost:5000" : appConfig.apiBaseUrl;
    // here we will get updated policy
    try {
      const response = await axios.post(
        `${baseUrl}/drsprinto/api/v1/reportDevice`,
        { data },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      );

      if (response.status === 200) {
        return true;
      }
    } catch (err) {
      log.error("services-->api:reportDevice", err);
    }
  }

  static async getPolicy(token, isDev) {
    const baseUrl = isDev ? "http://localhost:5000" : appConfig.apiBaseUrl;
    // here we will get updated policy
    try {
      const response = await axios.get(
        `${baseUrl}/drsprinto/api/v1/policyConfiguration`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
        }
      );

      return response.data.policy;
    } catch (err) {
      log.error("services-->api:getPolicy", err);
    }
  }
}
