import { isAppPageUrl, isExternalWebUrl, isTrustedUrl } from "./isTrustedUrl";
import yaml from "js-yaml";
import { readFileSync } from "fs";
import path from "path";

// every web link in the remediation instructions must be openable
const instructions = readFileSync(
  path.join(__dirname, "../practices/instructions.en.yaml"),
  "utf8"
);
const links = [...new Set(instructions.match(/https?:\/\/[^\s)"'<>\]]+/g) || [])];

describe("isExternalWebUrl", () => {
  it("finds the instruction links", () => {
    yaml.load(instructions);
    expect(links.length).toBeGreaterThan(5);
  });

  it.each(links)("opens instruction link %s", (link) => {
    expect(isTrustedUrl(link) || isExternalWebUrl(link)).toBe(true);
  });

  it.each([
    "http://www.avg.com/",
    "https://user:pass@evil.tld/",
    "file:///etc/passwd",
    "javascript:alert(1)",
    "smb://evil.tld/share",
    "drsprinto://main",
    "not a url",
    undefined,
  ])("refuses %s", (url) => {
    expect(isExternalWebUrl(url)).toBe(false);
  });
});

describe("isTrustedUrl (V8-2292)", () => {
  it.each([
    "https://sprinto.com",
    "https://app.sprinto.com/devices",
    "https://eu.sprinto.com/a?b=c",
  ])("trusts %s", (url) => {
    expect(isTrustedUrl(url)).toBe(true);
  });

  it.each([
    "http://app.sprinto.com",
    "http://localhost:3000",
    "https://localhost:3000",
    "http://127.0.0.1:37370",
    "https://127.0.0.1",
    "https://sprinto.com.attacker.tld",
    "https://evilsprinto.com",
    "https://evil.tld/x.sprinto.com",
    "https://user:pass@app.sprinto.com",
    "drsprinto://main",
    "file:///etc/passwd",
    "not a url",
    undefined,
  ])("does not trust %s", (url) => {
    expect(isTrustedUrl(url)).toBe(false);
  });
});

describe("isAppPageUrl (V8-2292)", () => {
  const packaged = "file:///Applications/DrSprinto.app/Contents/Resources/app.asar/build/index.html";
  const dev = "http://localhost:3000";

  it("allows the packaged app page, with any hash route", () => {
    expect(isAppPageUrl(packaged, packaged)).toBe(true);
    expect(isAppPageUrl(`${packaged}#/settings`, packaged)).toBe(true);
  });

  it("allows the dev server origin in development", () => {
    expect(isAppPageUrl("http://localhost:3000/", dev)).toBe(true);
    expect(isAppPageUrl("http://localhost:3000/static/x", dev)).toBe(true);
  });

  it.each([
    "https://app.sprinto.com",
    "http://app.sprinto.com",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "file:///etc/passwd",
    "file:///Applications/DrSprinto.app/Contents/Resources/app.asar/build/other.html",
    "drsprinto://main",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isAppPageUrl(url, packaged)).toBe(false);
    expect(isAppPageUrl(url, dev)).toBe(false);
  });
});
