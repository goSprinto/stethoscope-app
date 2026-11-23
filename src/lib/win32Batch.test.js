import { mapBatchResult } from "./win32Batch";

const batch = (overrides = {}) => ({
  os: { caption: "Microsoft Windows 11 Pro", version: "10.0.22631", serialNumber: "00330-80000-00000-AA123" },
  csp: { uuid: "4C4C4544-0042-3510-8052-B4C04F4E4D32", vendor: "Dell Inc.", version: "1.0" },
  machineGuid: "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
  bitlocker: "1",
  desktop: { active: "True", secure: "True", timeout: "600" },
  av: [{ name: "Windows Defender", productState: "397568" }],
  failed: [],
  ...overrides,
});

describe("win32 batch mappers", () => {
  it("maps os and hardware", () => {
    expect(mapBatchResult("os", batch())).toEqual({
      system: { name: "Microsoft Windows 11 Pro", platform: "Microsoft Windows 11 Pro", version: "10.0.22631" },
    });
    expect(mapBatchResult("hardware", batch())).toEqual({
      system: {
        uuid: "4C4C4544-0042-3510-8052-B4C04F4E4D32",
        hardwareVendor: "Dell Inc.",
        hardwareVersion: "1.0",
        machineGuid: "a1b2c3d4-e5f6-7890-abcd-ef0123456789",
        serialNumber: "00330-80000-00000-AA123",
      },
    });
  });

  it("leaves a blank caption undefined", () => {
    expect(mapBatchResult("os", batch({ os: { caption: "  ", version: "" } }))).toEqual({
      system: { name: undefined, platform: undefined, version: undefined },
    });
  });

  it("maps the screensaver, and a missing Win32_Desktop entry like screensaver.sh", () => {
    expect(mapBatchResult("screensaver", batch())).toEqual({
      screensaverEnabled: "True",
      screenlockEnabled: "True",
      screenlockDelay: "600",
    });
    expect(mapBatchResult("screensaver", batch({ desktop: null }))).toEqual({ screenlockDelay: "-1" });
  });

  it.each([
    ["0", "OFF"], ["1", "ON"], ["2", "OFF"], ["3", "ON"], ["4", "OFF"], ["5", "ON"], ["6", "OFF"],
  ])("maps BitLocker protection %s to %s", (value, status) => {
    expect(mapBatchResult("bitlocker", batch({ bitlocker: value }))).toEqual({ bitlockerStatus: status });
  });

  it("maps one, several or no antivirus products", () => {
    expect(mapBatchResult("antivirus", batch()).antivirusProducts).toEqual([
      { name: "Windows Defender", productState: "397568" },
    ]);
    // ConvertTo-Json unwraps a one-item array into an object
    expect(mapBatchResult("antivirus", batch({ av: { name: "Sophos", productState: "1" } })).antivirusProducts).toEqual([
      { name: "Sophos", productState: "1" },
    ]);
    expect(mapBatchResult("antivirus", batch({ av: [] })).antivirusProducts).toEqual([]);
    expect(mapBatchResult("antivirus", batch({ av: [{ name: "" }] })).antivirusProducts).toEqual([]);
  });

  it.each([
    ["os", "os"],
    ["hardware", "os"],
    ["hardware", "csp"],
    ["hardware", "machineGuid"],
    ["screensaver", "desktop"],
    ["antivirus", "av"],
    ["bitlocker", "bitlocker"],
  ])("falls back for %s when section %s failed", (file, section) => {
    expect(mapBatchResult(file, batch({ failed: [section] }))).toBe(null);
  });

  it("only falls back for the checks a failed section affects", () => {
    const data = batch({ failed: ["bitlocker"], bitlocker: "" });
    expect(mapBatchResult("bitlocker", data)).toBe(null);
    expect(mapBatchResult("os", data)).not.toBe(null);
    expect(mapBatchResult("screensaver", data)).not.toBe(null);
  });

  it("accepts failed as a single string (ConvertTo-Json unwrapping)", () => {
    expect(mapBatchResult("bitlocker", batch({ failed: "bitlocker" }))).toBe(null);
  });

  it("falls back for everything when the batch itself failed", () => {
    expect(mapBatchResult("os", null)).toBe(null);
  });
});
