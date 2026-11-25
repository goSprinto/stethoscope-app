import yaml from "js-yaml";
import { readFileSync } from "fs";
import path from "path";
import {
  APP_ORIGIN,
  fullMatch,
  isConfiguredOrigin,
  isWebAppOrigin,
  sprintoApiBaseUrl,
  storedBaseUrlAction,
} from "./originCheck";

const config = yaml.load(
  readFileSync(path.join(__dirname, "../practices/config.yaml"), "utf8")
);

describe("fullMatch", () => {
  it("rejects a prefix match even when the pattern is unanchored", () => {
    expect(fullMatch("^https://(.+\\.)?sprinto\\.(com|in)", "https://sprinto.com.attacker.tld")).toBe(false);
    expect(fullMatch("sprinto\\.com", "https://evil.tld/sprinto.com")).toBe(false);
  });

  it("accepts a whole-string match", () => {
    expect(fullMatch("^https://(.+\\.)?sprinto\\.(com|in)", "https://app.sprinto.com")).toBe(true);
  });

  it("rejects non-strings", () => {
    expect(fullMatch(".*", undefined)).toBe(false);
    expect(fullMatch(".*", null)).toBe(false);
  });
});

describe("isConfiguredOrigin (config.yaml)", () => {
  it.each([
    "https://sprinto.com",
    "https://app.sprinto.com",
    "https://eu.sprinto.com",
    "https://app.sprinto.in",
    APP_ORIGIN,
  ])("allows %s", (origin) => {
    expect(isConfiguredOrigin(origin, config)).toBe(true);
  });

  it.each([
    "https://sprinto.com.attacker.tld",
    "https://app.sprinto.com.attacker.tld",
    "https://sprinto.in.evil.com",
    "https://evilsprinto.com",
    "http://app.sprinto.com",
    "https://app.sprinto.com:8443",
    "drsprinto://main.evil",
    "null",
    "",
    undefined,
  ])("rejects %s", (origin) => {
    expect(isConfiguredOrigin(origin, config)).toBe(false);
  });
});

describe("isWebAppOrigin", () => {
  it.each([
    APP_ORIGIN,
    "https://app.sprinto.com",
    "https://eu.sprinto.com",
    "https://in.sprinto.com",
    "https://au.sprinto.com",
    "https://gcc.sprinto.com",
    "https://demo.sprinto.com",
    "http://localhost:3000",
    "http://127.0.0.1:5000",
  ])("allows %s", (origin) => {
    expect(isWebAppOrigin(origin)).toBe(true);
  });

  it.each([
    "https://app.sprinto.com.attacker.tld",
    "https://app.sprinto.computer",
    "http://localhost:3000.evil.tld",
    "http://127.0.0.1:5000@evil.tld",
    "drsprinto://evil",
    "drsprinto://main.evil",
    undefined,
  ])("rejects %s", (origin) => {
    expect(isWebAppOrigin(origin)).toBe(false);
  });
});

describe("sprintoApiBaseUrl", () => {
  it.each([
    ["https://app.sprinto.com", "https://app.sprinto.com"],
    ["https://app.sprinto.com/", "https://app.sprinto.com"],
    ["https://eu.sprinto.com", "https://eu.sprinto.com"],
    ["https://in.sprinto.com", "https://in.sprinto.com"],
    ["https://au.sprinto.com", "https://au.sprinto.com"],
    ["https://gcc.sprinto.com", "https://gcc.sprinto.com"],
    ["https://demo.sprinto.com", "https://demo.sprinto.com"],
    ["HTTPS://APP.SPRINTO.COM", "https://app.sprinto.com"],
  ])("accepts %s", (input, expected) => {
    expect(sprintoApiBaseUrl(input)).toBe(expected);
  });

  it.each([
    "http://app.sprinto.com",
    "https://app.sprinto.com.attacker.tld",
    "https://attacker.tld",
    "https://staging.sprinto.in",
    "https://us.sprinto.com",
    "https://sprinto.com",
    "https://app.sprinto.com:8443",
    "https://app.sprinto.com/evil",
    "https://app.sprinto.com/?x=1",
    "https://user:pass@app.sprinto.com",
    "http://127.0.0.1:8899",
    "http://localhost:5000",
    "not a url",
    "",
    undefined,
    {},
  ])("rejects %s", (input) => {
    expect(sprintoApiBaseUrl(input)).toBe(null);
  });

  it("accepts the local API server only in development", () => {
    expect(sprintoApiBaseUrl("http://localhost:5000", { isDev: true })).toBe("http://localhost:5000");
    expect(sprintoApiBaseUrl("http://localhost:5001", { isDev: true })).toBe(null);
  });
});

describe("storedBaseUrlAction", () => {
  it("keeps an allowed URL", () => {
    expect(storedBaseUrlAction("https://in.sprinto.com", true)).toBe("keep");
    expect(storedBaseUrlAction("https://gcc.sprinto.com/", true)).toBe("keep");
  });

  it("logs out a connected device whose URL isn't allowed", () => {
    expect(storedBaseUrlAction("http://127.0.0.1:8899", true)).toBe("logout");
    expect(storedBaseUrlAction("https://us.sprinto.com", true)).toBe("logout");
  });

  it("uses the default URL when none is stored or the device isn't connected", () => {
    expect(storedBaseUrlAction(null, true)).toBe("default");
    expect(storedBaseUrlAction("", true)).toBe("default");
    expect(storedBaseUrlAction("http://127.0.0.1:8899", false)).toBe("default");
  });
});
