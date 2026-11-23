/** @jest-environment node */
import fs from "fs";
import os from "os";
import path from "path";
const { signArgs, batchFiles, findBinaries, certificateThumbprint } = require("../scripts/afterPack");

const THUMB = "0123456789abcdef0123456789ABCDEF01234567";

describe("Windows signing with the hardware token (V8-2214)", () => {
  afterEach(() => { delete process.env.SHA1KEY; });

  it("never passes a certificate file or password to signtool", () => {
    const args = signArgs(THUMB, ["a.exe", "b.dll"]);
    expect(args).not.toContain("/f");
    expect(args).not.toContain("/p");
    expect(args.slice(0, 3)).toEqual(["sign", "/sha1", THUMB]);
    expect(args.slice(-2)).toEqual(["a.exe", "b.dll"]);
  });

  it("takes the thumbprint from SHA1KEY, ignoring spaces", () => {
    process.env.SHA1KEY = "01 23 45 67 89 ab cd ef 01 23 45 67 89 AB CD EF 01 23 45 67";
    expect(certificateThumbprint()).toBe(THUMB);
  });

  it.each([undefined, "", "abc", `${THUMB}00`, "z".repeat(40)])("refuses SHA1KEY %p", (value) => {
    if (value !== undefined) process.env.SHA1KEY = value;
    expect(() => certificateThumbprint()).toThrow(/thumbprint/);
  });

  it("signs all files in one run for a normal build", () => {
    const files = Array.from({ length: 40 }, (_, i) => `C:\\build\\win-unpacked\\resources\\file${i}.dll`);
    expect(batchFiles(files)).toEqual([files]);
  });

  it("splits very long file lists to stay under the command-line limit", () => {
    const files = Array.from({ length: 400 }, (_, i) => `C:\\${"x".repeat(100)}\\file${i}.dll`);
    const batches = batchFiles(files);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flat()).toEqual(files);
    batches.forEach((b) => expect(b.join(" ").length).toBeLessThan(30000));
  });

  it("finds .dll and .exe files in subfolders", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "afterpack-"));
    try {
      fs.mkdirSync(path.join(dir, "resources", "bitlocker"), { recursive: true });
      ["DrSprinto.exe", "ffmpeg.dll", "LICENSE", "resources/app.asar", "resources/bitlocker/X.DLL"].forEach((f) =>
        fs.writeFileSync(path.join(dir, f), ""));
      const found = findBinaries(dir).map((f) => path.relative(dir, f)).sort();
      expect(found).toEqual(["DrSprinto.exe", "ffmpeg.dll", path.join("resources", "bitlocker", "X.DLL")].sort());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
