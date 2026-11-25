import pkg from "../package.json";
import { readFileSync } from "fs";
import path from "path";
import yaml from "js-yaml";

// electron-updater fetches latest*.yml, and the sha512 it checks the download
// against, from these URLs; over http a network attacker controls both (V8-2209)
describe("update feed", () => {
  it("publishes every update feed over https", () => {
    const urls = pkg.build.publish.map(({ url }) => url);
    expect(urls.length).toBeGreaterThan(0);
    urls.forEach((url) => expect(url).toMatch(/^https:\/\//));
  });

  it("uses https for the dev update feed", () => {
    const devFeed = yaml.load(
      readFileSync(path.join(__dirname, "../dev-app-update.yml"), "utf8")
    );
    expect(devFeed.url).toMatch(/^https:\/\//);
  });
});
