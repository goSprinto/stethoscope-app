import { readdirSync } from "fs";
import path from "path";
import { appNameMatches, isSafeRegistryPath } from "./appPolicy";
import { DEFAULT_WIN32_APP_REGISTRY_PATH } from "../constants";

describe("appNameMatches", () => {
  it("matches case-insensitively as text", () => {
    expect(appNameMatches("slack", "Slack Technologies Slack")).toBe(true);
    expect(appNameMatches("Slack.app", "Slack.app")).toBe(true);
    expect(appNameMatches("Slack.app", "Slackxapp")).toBe(false);
  });

  it("returns quickly for a catastrophic regex pattern", () => {
    const start = Date.now();
    expect(appNameMatches("(a+)+$", "a".repeat(5000) + "!")).toBe(false);
    expect(Date.now() - start).toBeLessThan(100);
  });
});

describe("isSafeRegistryPath", () => {
  it.each([
    DEFAULT_WIN32_APP_REGISTRY_PATH,
    "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKEY_LOCAL_MACHINE\\Software\\Vendor (x86)\\App-1.0",
  ])("allows %s", (value) => {
    expect(isSafeRegistryPath(value)).toBe(true);
  });

  it.each([
    "HKLM\\Software' & calc.exe & '",
    'HKLM\\Software" & calc',
    "HKLM\\Software\\$(whoami)",
    "HKLM\\Software\\a;b",
    "HKLM\\Software\\a|b",
    "HKLM\\Software\n\\x",
    "HKU\\S-1-5-18\\Software",
    "some\\nonstandard\\regpath",
    "HKLM",
    "",
    undefined,
    "HKLM\\" + "a".repeat(300),
  ])("refuses %j", (value) => {
    expect(isSafeRegistryPath(value)).toBe(false);
  });
});

// the apps scripts splice policy values into shell commands; they ship
// disabled. Re-enabling one needs a review of its inputs first (V8-2212)
describe("app inventory scripts", () => {
  it.each(["darwin", "win32", "linux"])("stay disabled on %s", (platform) => {
    const dir = path.join(__dirname, "../sources", platform);
    const enabled = readdirSync(dir).filter((f) => /^apps?\.sh$/.test(f));
    expect(enabled).toEqual([]);
  });
});
