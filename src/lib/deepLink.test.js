import { parseDeepLink, deepLinkFromArgv } from "./deepLink";

describe("parseDeepLink (V8-2293)", () => {
  it.each([
    ["drsprinto://update", "update"],
    ["drsprinto://update/", "update"],
    ["DRSPRINTO://UPDATE", "update"],
    ["drsprinto://update?from=web", "update"],
    ["drsprinto://debugger", "debugger"],
    ["drsprinto://debugger/", "debugger"],
    ["drsprinto://main", "open"],
    ["drsprinto://", "open"],
    // a word inside another link no longer triggers anything
    ["drsprinto://main?x=debugger", "open"],
    ["drsprinto://main/update", "open"],
    ["drsprinto://anything#update", "open"],
    ["drsprinto://updater", "open"],
    ["drsprinto://enableDebugger", "open"],
  ])("%s -> %s", (link, expected) => {
    expect(parseDeepLink(link)).toBe(expected);
  });

  it.each(["https://app.sprinto.com/update", "update", "stethoscope://update", "", undefined, null, {}])(
    "ignores %p",
    (value) => {
      expect(parseDeepLink(value)).toBe(null);
    }
  );
});

describe("deepLinkFromArgv", () => {
  it("finds the link among the Windows launch arguments", () => {
    expect(deepLinkFromArgv(["C:\\DrSprinto.exe", "--flag", "drsprinto://update"])).toBe("drsprinto://update");
  });

  it("never treats other arguments as a link", () => {
    expect(deepLinkFromArgv(["C:\\Program Files\\DrSprinto\\update\\DrSprinto.exe", "--updated"])).toBe(null);
    expect(deepLinkFromArgv([])).toBe(null);
    expect(deepLinkFromArgv(undefined)).toBe(null);
  });
});
