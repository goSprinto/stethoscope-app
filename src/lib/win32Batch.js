/**
 * Windows only: collects the data behind sources/win32/{os,hardware,
 * screensaver,antivirus,bitlocker}.sh from a single PowerShell process.
 *
 * Starting PowerShell and loading CIM costs ~2s per process while each query
 * takes only tens of ms, so running the four scripts separately spent almost
 * all of a scan waiting on process startup.
 *
 * The mapped results match the output shapes of those .sh scripts exactly. If
 * the batch fails, or one of its sections does, callers fall back to running
 * the .sh script for the checks affected.
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

// Each section records its own failure in `failed`; only those checks fall
// back to their .sh script. With one global SilentlyContinue, a failed query
// looked like a real value instead (e.g. BitLocker OFF, a missing uuid).
//
// Everything here must also work under Constrained Language Mode, which
// WDAC/AppLocker enforce on managed fleets: the user comes from environment
// variables (not WindowsIdentity), and the BitLocker COM call is skipped
// there so that check falls back to bitlocker-status.exe.
const SCRIPT = `
$ErrorActionPreference = 'Stop'
$failed = @()
$fullLanguage = $ExecutionContext.SessionState.LanguageMode -eq 'FullLanguage'

$os = $null
try { $os = Get-CimInstance Win32_OperatingSystem } catch { }
if (-not $os) { $failed += 'os' }

$csp = $null
try { $csp = Get-CimInstance Win32_ComputerSystemProduct } catch { }
if (-not $csp) { $failed += 'csp' }

$guid = $null
try { $guid = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography').MachineGuid } catch { }
if (-not $guid) { $failed += 'machineGuid' }

$desktop = $null
try {
  $me = "$env:USERDOMAIN\\$env:USERNAME"
  $all = @(Get-CimInstance Win32_Desktop)
  $desk = $all | Where-Object { $_.Name -eq $me } | Select-Object -First 1
  if (-not $desk) {
    $mine = @($all | Where-Object { $_.Name -like ('*\\' + $env:USERNAME) })
    if ($mine.Count -eq 1) { $desk = $mine[0] }
  }
  if ($desk) {
    $desktop = @{
      active = [string]$desk.ScreenSaverActive
      secure = [string]$desk.ScreenSaverSecure
      timeout = [string]$desk.ScreenSaverTimeout
    }
  }
} catch { $failed += 'desktop' }

$av = @()
try {
  $av = @(Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object {
    @{ name = [string]$_.displayName; productState = [string]$_.productState }
  })
} catch { $failed += 'av' }

$bitlocker = $null
if ($fullLanguage) {
  try {
    $bitlocker = (New-Object -ComObject Shell.Application).NameSpace('C:\\').Self.ExtendedProperty('System.Volume.BitLockerProtection')
  } catch { }
}
if ($null -eq $bitlocker -or [string]$bitlocker -eq '') { $failed += 'bitlocker' }

$osInfo = $null
if ($os) { $osInfo = @{ caption = [string]$os.Caption; version = [string]$os.Version; serialNumber = [string]$os.SerialNumber } }
$cspInfo = $null
if ($csp) { $cspInfo = @{ uuid = [string]$csp.UUID; vendor = [string]$csp.Vendor; version = [string]$csp.Version } }

@{
  os = $osInfo
  csp = $cspInfo
  machineGuid = [string]$guid
  bitlocker = [string]$bitlocker
  desktop = $desktop
  av = $av
  failed = @($failed)
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

// sections each script's data comes from; if any of them failed, that script
// returns null and kmd runs its .sh script instead
const SECTIONS = {
  os: ["os"],
  hardware: ["os", "csp", "machineGuid"],
  screensaver: ["desktop"],
  antivirus: ["av"],
  bitlocker: ["bitlocker"],
};

export const mappers = {
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

// the result for one script from the batch output, or null when a section it
// needs failed
export function mapBatchResult(file, data) {
  if (!data) return null;
  const failed = [].concat(data.failed || []);
  if (SECTIONS[file].some((section) => failed.includes(section))) {
    return null;
  }
  return mappers[file](data);
}

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
  return mapBatchResult(file, await context.__win32Batch);
}
