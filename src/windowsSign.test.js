/** @jest-environment node */
import path from "path";
const { sign, signArgs, certificateThumbprint, getSigntoolPath } = require("../scripts/windowsSign");
const afterPack = require("../scripts/afterPack");
const pkg = require("../package.json");

const THUMB = "0123456789abcdef0123456789ABCDEF01234567";
const ENV = { SHA1KEY: THUMB, SIGNTOOL_PATH: "C:\\sdk\\signtool.exe" };

describe("Windows signing with the hardware token (V8-2214, V8-2295)", () => {
  it("never passes a certificate file or password to signtool", () => {
    const args = signArgs(THUMB, "a.exe");
    expect(args).not.toContain("/f");
    expect(args).not.toContain("/p");
    expect(args.slice(0, 3)).toEqual(["sign", "/sha1", THUMB]);
    expect(args[args.length - 1]).toBe("a.exe");
    expect(args).not.toContain("/as");
    expect(signArgs(THUMB, "a.exe", true)).toContain("/as");
  });

  it("takes the thumbprint from SHA1KEY, ignoring spaces", () => {
    expect(certificateThumbprint({ SHA1KEY: "01 23 45 67 89 ab cd ef 01 23 45 67 89 AB CD EF 01 23 45 67" })).toBe(THUMB);
  });

  it.each([undefined, "", "abc", `${THUMB}00`, "z".repeat(40)])("refuses SHA1KEY %p", (value) => {
    expect(() => certificateThumbprint({ SHA1KEY: value })).toThrow(/thumbprint/);
  });

  it("uses SIGNTOOL_PATH, else the newest Windows SDK", () => {
    expect(getSigntoolPath({ SIGNTOOL_PATH: "X:\\signtool.exe" })).toBe("X:\\signtool.exe");
    const env = { "ProgramFiles(x86)": "PF" };
    const bin = path.join("PF", "Windows Kits", "10", "bin");
    const found = getSigntoolPath(env, (p) => p === bin || p.includes("10.0.22621.0") || p.includes("10.0.9.0"),
      () => ["10.0.17763.0", "10.0.22621.0", "10.0.9.0", "x64"]);
    expect(found).toBe(path.join(bin, "10.0.22621.0", "x64", "signtool.exe"));
    expect(getSigntoolPath(env, () => false)).toBe("signtool.exe");
  });

  it("signs the file electron-builder passes, with the token", async () => {
    const calls = [];
    await sign({ path: "C:\\dist\\DrSprinto Setup.exe" }, { env: ENV, run: (...a) => calls.push(a) });
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(ENV.SIGNTOOL_PATH);
    expect(calls[0][1]).toEqual(signArgs(THUMB, "C:\\dist\\DrSprinto Setup.exe", false));
  });

  it("fails the build when signtool fails", async () => {
    const run = () => { const e = new Error("exit"); e.status = 1; throw e; };
    await expect(sign({ path: "a.dll" }, { env: ENV, run })).rejects.toThrow(/exited with 1.*hardware token/);
  });

  it("names the missing Windows SDK when signtool is not found", async () => {
    const run = () => { const e = new Error("spawn"); e.code = "ENOENT"; throw e; };
    await expect(sign({ path: "a.dll" }, { env: ENV, run })).rejects.toThrow(/signtool was not found.*Windows SDK/);
  });

  it("fails the build without a valid SHA1KEY, before running signtool", async () => {
    const run = jest.fn();
    await expect(sign({ path: "a.dll" }, { env: {}, run })).rejects.toThrow(/SHA1KEY/);
    expect(run).not.toHaveBeenCalled();
  });

  it("is the sign hook electron-builder loads from package.json", async () => {
    const opts = pkg.build.win.signtoolOptions;
    expect(opts.sign).toBe("./scripts/windowsSign.js");
    expect(opts.signingHashAlgorithms).toEqual(["sha256"]);
    expect(pkg.build.win.signAndEditExecutable).not.toBe(false);
    expect(pkg.build.win.signExts).toContain(".dll");
    const { resolveFunction } = require("app-builder-lib/out/util/resolve");
    const cwd = process.cwd();
    process.chdir(path.join(__dirname, ".."));
    try {
      const hook = await resolveFunction("commonjs", opts.sign, "sign", process.cwd());
      expect(hook).toBe(sign);
    } finally {
      process.chdir(cwd);
    }
  });

  it("afterPack no longer signs on Windows", async () => {
    const log = console.log;
    console.log = () => {};
    try {
      await expect(afterPack({ appOutDir: "/does/not/exist", electronPlatformName: "win32" })).resolves.toBeUndefined();
      await expect(afterPack({ appOutDir: "/does/not/exist", electronPlatformName: "darwin" })).resolves.toBeUndefined();
    } finally {
      console.log = log;
    }
  });
});
