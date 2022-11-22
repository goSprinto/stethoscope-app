import appConfig from "./config.json";
import Store from "electron-store";
import { safeStorage } from "electron";

const authData = new Store({
  name: "sprintoAuth",
  watch: true,
  encryptionKey: appConfig.encryptionKey,
});

const key = "authCreds";

export default class AuthService {
  static getAccessToken() {
    const accessToken = authData.get(key);
    return safeStorage.decryptString(Buffer.from(accessToken, "latin1"));
  }

  static storeAccessToken(token) {
    const buffer = safeStorage.encryptString(token);
    authData.set(key, buffer.toString("latin1"));
  }

  static storeProfile(firstName) {
    const buffer = safeStorage.encryptString(firstName);
    authData.set(key, buffer.toString("latin1"));
  }

  static async logout() {
    authData.delete(key);
  }
}
