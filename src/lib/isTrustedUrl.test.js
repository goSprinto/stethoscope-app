import { isExternalWebUrl, isTrustedUrl } from "./isTrustedUrl";
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
