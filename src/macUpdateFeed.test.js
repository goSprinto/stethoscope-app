import fs from "fs";
import os from "os";
import path from "path";
import yaml from "js-yaml";
import semver from "semver";
import pkg from "../package.json";
const { setMinimumSystemVersion } = require("../scripts/setMacMinimumSystemVersion");

const FEED = `version: 4.0.9
files:
  - url: DrSprinto-4.0.9-mac.zip
    sha512: abc
    size: 1
path: DrSprinto-4.0.9-mac.zip
sha512: abc
releaseDate: '2026-11-22T00:00:00.000Z'
`;

describe("mac update feed", () => {
  it("adds minimumSystemVersion and keeps the rest of the feed", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "feed-"));
    const file = path.join(dir, "latest-mac.yml");
    fs.writeFileSync(file, FEED);
    setMinimumSystemVersion(file);
    const info = yaml.load(fs.readFileSync(file, "utf8"));
    expect(info).toEqual({ ...yaml.load(FEED), minimumSystemVersion: "22.0.0" });
    fs.rmSync(dir, { recursive: true });
  });

  // electron-updater skips the update when semver.lt(os.release(), minimumSystemVersion)
  it.each([
    ["19.6.0", true], // Catalina
    ["21.6.0", true], // Monterey
    ["22.1.0", false], // Ventura
    ["25.0.0", false],
  ])("Darwin %s skipped: %s", (release, skipped) => {
    expect(semver.lt(release, "22.0.0")).toBe(skipped);
  });

  it("runs as part of the mac build", () => {
    expect(pkg.scripts["build:mac"]).toContain("build:mac-feed");
    expect(pkg.build.mac.minimumSystemVersion).toBe("13.0");
  });
});
