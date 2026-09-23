/**
 * Windows only: collects the data behind sources/win32/{os,hardware,
 * screensaver,antivirus,bitlocker}.sh from a single PowerShell process.
 *
 * Starting PowerShell and loading CIM costs ~2s per process while each query
 * takes only tens of ms, so running the four scripts separately spent almost
 * all of a scan waiting on process startup.
 *
 * The mapped results match the output shapes of those .sh scripts exactly; if
 * the batch fails for any reason, callers fall back to running the .sh script.
 */
import { execFile } from "child_process";

export const WIN32_BATCHED_SCRIPTS = [
  "os",
  "hardware",
  "screensaver",
  "antivirus",
  "bitlocker",
];

// bitlocker-status.exe (see bitlocker-status/Program.cs) reads this same shell
// property for C: and reports ON for these values; the exe itself takes 5-9s
// to start, almost all of it .NET and WindowsAPICodePack loading
const BITLOCKER_ON_VALUES = [1, 3, 5];

const BATCH_TIMEOUT_MS = 60000;

// the current user is read from WindowsIdentity rather than `whoami` so a
// different whoami earlier on PATH (e.g. Git for Windows) can't break the match
const SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
$os = Get-CimInstance Win32_OperatingSystem
$csp = Get-CimInstance Win32_ComputerSystemProduct
$me = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$desk = Get-CimInstance Win32_Desktop | Where-Object { $_.Name -eq $me } | Select-Object -First 1
$av = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object {
  @{ name = [string]$_.displayName; productState = [string]$_.productState }
})
$guid = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid
$bitlocker = (New-Object -ComObject Shell.Application).NameSpace('C:\\').Self.ExtendedProperty('System.Volume.BitLockerProtection')
$desktop = $null
if ($desk) {
  $desktop = @{
    active = [string]$desk.ScreenSaverActive
    secure = [string]$desk.ScreenSaverSecure
    timeout = [string]$desk.ScreenSaverTimeout
  }
}
@{
  os = @{ caption = [string]$os.Caption; version = [string]$os.Version; serialNumber = [string]$os.SerialNumber }
  csp = @{ uuid = [string]$csp.UUID; vendor = [string]$csp.Vendor; version = [string]$csp.Version }
  machineGuid = [string]$guid
  bitlocker = [string]$bitlocker
  desktop = $desktop
  av = $av
} | ConvertTo-Json -Compress -Depth 4
`;

function runPowershell() {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell",
      ["-NoProfile", "-NonInteractive", "-Command", SCRIPT],
      { timeout: BATCH_TIMEOUT_MS, windowsHide: true, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) return reject(error);
        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

// mirror the `extract <regex>` steps in the .sh scripts: first capture group,
// or undefined when the value is missing or doesn't match
const extract = (value, regex) => {
  const match = regex.exec(String(value || ""));
  return match ? match[1] : undefined;
};

const blankToUndefined = (value) => {
  const trimmed = String(value || "").trim();
  return trimmed === "" ? undefined : trimmed;
};

const mappers = {
  os: ({ os = {} }) => {
    const caption = blankToUndefined(os.caption);
    return {
      system: {
        name: caption,
        platform: caption,
        version: extract(os.version, /^([\d.]+)/),
      },
    };
  },

  hardware: ({ os = {}, csp = {}, machineGuid }) => ({
    system: {
      uuid: extract(csp.uuid, /^([\w\d-]+)/),
      hardwareVendor: blankToUndefined(csp.vendor),
      hardwareVersion: blankToUndefined(csp.version),
      machineGuid: extract(machineGuid, /^([\w\d-]+)/),
      serialNumber: extract(os.serialNumber, /^([\d\-A-Z]+)/),
    },
  }),

  screensaver: ({ desktop }) => {
    if (!desktop) return { screenlockDelay: "-1" };
    return {
      screensaverEnabled: blankToUndefined(desktop.active),
      screenlockEnabled: blankToUndefined(desktop.secure),
      screenlockDelay: extract(desktop.timeout, /^([0-9]+)/) || "-1",
    };
  },

  bitlocker: ({ bitlocker }) => ({
    bitlockerStatus: BITLOCKER_ON_VALUES.includes(parseInt(bitlocker, 10))
      ? "ON"
      : "OFF",
  }),

  antivirus: ({ av = [] }) => ({
    antivirusProducts: (Array.isArray(av) ? av : [av])
      .filter((product) => product && product.name)
      .map(({ name, productState }) => ({ name, productState })),
  }),
};

/**
 * Returns the result for `file` from the shared batch run stored on `context`,
 * or null if the batch failed (caller should fall back to the .sh script).
 */
export async function runBatched(file, context) {
  if (!context.__win32Batch) {
    context.__win32Batch = runPowershell().catch((e) => {
      console.error("win32Batch: falling back to individual scripts", e);
      return null;
    });
  }
  const data = await context.__win32Batch;
  return data ? mappers[file](data) : null;
}
