import axios from "axios";


export default class ApiService {
  static async reportDevice(baseUrl, token, data, ) {

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
      log.info("Reporting device now", {baseUrl,});
      return true;
    } catch (err) {
      log.error("services-->api:reportDevice",  {err: JSON.stringify({ err }), baseUrl});
      throw err;
    }
  }

  static async getPolicy(baseUrl, token, ) {

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
      log.info("getPolicy: fetching policy now", {baseUrl,});
      return response.data.policy;
    } catch (err) {
      log.error("services-->api:getPolicy", {err: JSON.stringify({ err }), baseUrl});
      throw err;
    }
  }
}
