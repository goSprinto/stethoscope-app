/* global fetch */
import { HOST, PASS, FAIL } from "../constants";
const remote = window.require("@electron/remote");
const log = remote.getGlobal("log");

const handleValidate = (result, partitions, device, practices, platform) => {
  const { status, ...rest } = result;
  const nonNullValues = Object.keys(rest).filter((key) => result[key]);

  return nonNullValues.reduce((acc, key) => {
    let itemStatus = rest[key];
    // some policy results are enumerable, reduce them to PASS/FAIL
    if (Array.isArray(itemStatus)) {
      if (itemStatus.every((item) => item.status === PASS)) {
        itemStatus = PASS;
      } else if (itemStatus.some((item) => item.status === FAIL)) {
        itemStatus = FAIL;
      }
    }

    let item = {};

    try {
      item = {
        title: key,
        name: key,
        status: itemStatus,
        actions: "",
        link: "",
        ...practices[key],
        directions: practices[key].directions[platform],
      };
    } catch (e) {
      log.error(`Stethoscope:handleValidate - ${e.message}`);
      return acc;
    }

    if (Array.isArray(rest[key])) {
      item.results = rest[key];
    }

    switch (itemStatus) {
      case "PASS":
        acc.done.push(item);
        break;
      case "FAIL":
        acc.critical.push(item);
        break;
      case "UNKNOWN":
        acc.unknown.push(item);
        break;
      case "ERROR":
        acc.error.push(item);
        break;
      default:
        acc.suggested.push(item);
    }

    return acc;
  }, partitions);
};

export default class Stethoscope {
  static partitionSecurityInfo(policy, result, device, practices, platform) {
    const partitions = {
      critical: [],
      suggested: [],
      unknown: [],
      done: [],
      error: [],
    };

    return handleValidate(result, partitions, device, practices, platform);
  }
  // privately retry request until a response is given
  static __repeatRequest(policy, resolve, reject) {
    const query = `query ValidateDevice($policy: DevicePolicy!) {
      policy {
        validate(policy: $policy) {
          status
          osVersion
          diskEncryption
          screenLock
          screenIdle
          antivirus
          stethoscopeVersion
        }
      }

      device {
        deviceId
        deviceName
        serialNumber
        platform
        platformName
        distroName
        osVersion
        osName
        firmwareVersion
        hardwareModel
        friendlyName
        hardwareSerial
        stethoscopeVersion
        screenLockDelay
        security (policy: $policy) {
          diskEncryption
          screenLock
          screenIdle
          antivirus {
             activeProviders {
               name
             }
           }
        }
      }
    }`;

    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { policy } }),
    };

    fetch(`${HOST}/scan`, options)
      .then((res) => {
        switch (res.status) {
          case 200:
            return res.json();
          case 204:
            throw new Error("retry");
          default:
            return res;
        }
      })
      .then(({ errors, data = {}, extensions = {} }) => {
        const { timing = { total: 0 } } = extensions;
        const { policy, device } = data;
        if (errors) {
          reject({ errors });
        } else {
          const { validate: result } = policy;
          resolve({ result, device, timing });
        }
      })
      .catch((err) => {
        if (err.message === "retry") {
          return this.__repeatRequest(policy, resolve, reject);
        } else {
          reject(err);
        }
      });
  }

  // public API
  static validate(policy) {
    return new Promise((resolve, reject) => {
      this.__repeatRequest(policy, resolve, reject);
    });
  }
}
