import yaml from "js-yaml";
import { readFileSync } from "fs";
import path from "path";
import {
  APP_ORIGIN,
  fullMatch,
  isConfiguredOrigin,
  isWebAppOrigin,
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
    "https://us.sprinto.com",
    "https://au.sprinto.com",
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
