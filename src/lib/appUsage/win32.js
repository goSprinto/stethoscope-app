import { execFile } from 'child_process'
import log from '../logger'

// Explorer records a launch count and last-launch time per program under
// UserAssist. It is per-user (HKCU) and needs no elevation.
const USER_ASSIST_KEY =
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist'

// UserAssist is partitioned by GUID; only these two hold program launches.
// The others track UI element counts, which say nothing about app usage.
const EXECUTABLE_GUID = '{CEBFF5CD-ACE2-4F4F-9178-9926F41749EA}'
const SHORTCUT_GUID = '{F4E57C4B-2036-45F0-A9AB-443BCFE33D9F}'
const LAUNCH_GUIDS = [EXECUTABLE_GUID, SHORTCUT_GUID]

// Entry names are stored ROT13-encoded, with well-known directories collapsed to
// their KNOWNFOLDERID. Expanding the common ones lets the decoded path be matched
// against an app's install location; unrecognised GUIDs are left as-is and simply
// fail to match.
const KNOWN_FOLDERS = {
  '{6D809377-6AF0-444B-8957-A3773F02200E}': 'C:\\Program Files',
  '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}': 'C:\\Program Files (x86)',
  '{905E63B6-C1BF-494E-B29C-65B732D3D21A}': 'C:\\Program Files',
  '{F38BF404-1D43-42F2-9305-67DE0B28FC23}': 'C:\\Windows',
  '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}': 'C:\\Windows\\System32',
  '{D65231B0-B2F1-4857-A4CE-A8E7C6EA7D27}': 'C:\\Windows\\SysWOW64',
  '{0139D44E-6AFE-49F2-8690-3DAFCAE6FFB8}':
    'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs',
  '{A77F5D77-2E2B-44C3-A6A2-ABA601054A51}':
    '%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs',
  '{9E3995AB-1F9C-4F13-B827-48B24B6C7174}':
    '%APPDATA%\\Microsoft\\Internet Explorer\\Quick Launch\\User Pinned',
  '{374DE290-123F-4565-9164-39C4925E467B}': '%USERPROFILE%\\Downloads',
  '{B4BFCC3A-DB2C-424C-B029-7FE99A87C641}': '%USERPROFILE%\\Desktop'
}

// "HKEY_CURRENT_USER\...\{GUID}\Count"
const KEY_LINE = /^HKEY_CURRENT_USER\\.*\\({[0-9A-Fa-f-]+})\\Count\s*$/
// "    <rot13 name>    REG_BINARY    0000000005000000..."
const VALUE_LINE = /^\s+(\S.*?)\s+REG_BINARY\s+([0-9A-Fa-f]+)\s*$/

// Win7+ writes a 72-byte record; the fields we read live at these offsets.
const OFFSET_RUN_COUNT = 4
const OFFSET_LAST_USED = 60
const MODERN_RECORD_MIN_BYTES = OFFSET_LAST_USED + 8

// Pre-Vista records are 16 bytes with the timestamp immediately after the count.
const LEGACY_OFFSET_LAST_USED = 8
const LEGACY_RECORD_MIN_BYTES = LEGACY_OFFSET_LAST_USED + 8

// FILETIME counts 100ns intervals from 1601-01-01; JS counts ms from 1970-01-01.
const FILETIME_TICKS_PER_MS = 10000n
const FILETIME_TO_UNIX_EPOCH_MS = 11644473600000n

// guards against a garbage blob yielding a plausible-looking Date
const MIN_PLAUSIBLE_MS = Date.parse('1995-01-01T00:00:00Z')
const MAX_PLAUSIBLE_MS = Date.parse('2100-01-01T00:00:00Z')

const rot13 = (value) =>
  value.replace(/[a-zA-Z]/g, (char) => {
    const code = char.charCodeAt(0)
    const base = code < 97 ? 65 : 97
    return String.fromCharCode(((code - base + 13) % 26) + base)
  })

const runReg = (args) =>
  new Promise((resolve, reject) => {
    execFile('reg', args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      // reg exits non-zero when a key is absent, which is a normal outcome here
      if (err && !stdout) return reject(err)
      resolve(stdout)
    })
  })

const filetimeToIso = (filetime) => {
  if (!filetime) return null
  const ms = Number(filetime / FILETIME_TICKS_PER_MS - FILETIME_TO_UNIX_EPOCH_MS)
  if (ms < MIN_PLAUSIBLE_MS || ms > MAX_PLAUSIBLE_MS) return null
  return new Date(ms).toISOString()
}

const parseRecord = (hex) => {
  const buffer = Buffer.from(hex, 'hex')

  if (buffer.length >= MODERN_RECORD_MIN_BYTES) {
    return {
      useCount: buffer.readUInt32LE(OFFSET_RUN_COUNT),
      lastUsedAt: filetimeToIso(buffer.readBigUInt64LE(OFFSET_LAST_USED))
    }
  }

  if (buffer.length >= LEGACY_RECORD_MIN_BYTES) {
    return {
      useCount: buffer.readUInt32LE(OFFSET_RUN_COUNT),
      lastUsedAt: filetimeToIso(buffer.readBigUInt64LE(LEGACY_OFFSET_LAST_USED))
    }
  }

  return null
}

const expandKnownFolders = (entryPath) => {
  const match = entryPath.match(/^({[0-9A-Fa-f-]+})\\?(.*)$/)
  if (!match) return entryPath

  const [, guid, rest] = match
  const folder = KNOWN_FOLDERS[guid.toUpperCase()]
  return folder ? (rest ? `${folder}\\${rest}` : folder) : entryPath
}

const normalize = (value = '') =>
  String(value).replace(/\//g, '\\').replace(/\\+$/, '').trim().toLowerCase()

// "...\\Slack.lnk" and "...\\slack.exe" both describe the app named "Slack"
const launchedName = (entryPath) => {
  const leaf = entryPath.split('\\').pop() || ''
  return leaf.replace(/\.(exe|lnk)$/i, '').trim().toLowerCase()
}

/**
 * Reads every program launch UserAssist knows about.
 */
export const readUserAssistEntries = async () => {
  const stdout = await runReg(['query', USER_ASSIST_KEY, '/s'])
  const wanted = LAUNCH_GUIDS.map((guid) => guid.toUpperCase())
  const entries = []
  let inLaunchSection = false

  for (const line of stdout.split(/\r?\n/)) {
    const keyMatch = line.match(KEY_LINE)
    if (keyMatch) {
      inLaunchSection = wanted.includes(keyMatch[1].toUpperCase())
      continue
    }
    if (!inLaunchSection) continue

    const valueMatch = line.match(VALUE_LINE)
    if (!valueMatch) continue

    const record = parseRecord(valueMatch[2])
    if (!record) continue

    const entryPath = expandKnownFolders(rot13(valueMatch[1]))
    entries.push({ ...record, path: entryPath })
  }

  return entries
}

const merge = (current, entry) => {
  if (!current) {
    return { lastUsedAt: entry.lastUsedAt, useCount: entry.useCount }
  }
  return {
    // an app has several launchable binaries and shortcuts; the most recent of
    // them is when the app was last used, and the counts are cumulative
    lastUsedAt:
      !current.lastUsedAt ||
      (entry.lastUsedAt && entry.lastUsedAt > current.lastUsedAt)
        ? entry.lastUsedAt
        : current.lastUsedAt,
    useCount: (current.useCount || 0) + (entry.useCount || 0)
  }
}

/**
 * Reads last-launch time and cumulative launch count for the given applications.
 * Returns a Map keyed by the app's index in `apps`.
 *
 * The uninstall registry identifies an app by display name and install location,
 * while UserAssist identifies it by executable or shortcut path, so the two are
 * joined on install location first and on the launched file's name second. Apps
 * that were never started from Explorer have no UserAssist entry at all.
 */
export default async function getWin32AppUsage (apps = []) {
  const usage = new Map()

  let entries
  try {
    entries = await readUserAssistEntries()
  } catch (e) {
    log.error('appUsage:win32 - reading UserAssist failed', {
      err: e && e.message ? e.message : String(e)
    })
    return usage
  }

  const locations = []
  const indexByName = new Map()

  apps.forEach((app, index) => {
    // on Windows `path` holds the install directory from the uninstall registry
    const location = normalize(app.path)
    // a bare drive root would swallow every entry
    if (location && location.length > 3) {
      locations.push({ location, index })
    }
    const name = normalize(app.name)
    if (name && !indexByName.has(name)) {
      indexByName.set(name, index)
    }
  })

  // longest location first, so a nested install is preferred over its parent
  locations.sort((a, b) => b.location.length - a.location.length)

  for (const entry of entries) {
    const entryPath = normalize(entry.path)
    const byLocation = locations.find(
      ({ location }) =>
        entryPath === location || entryPath.startsWith(`${location}\\`)
    )
    const index = byLocation
      ? byLocation.index
      : indexByName.get(launchedName(entry.path))

    if (index === undefined) continue
    usage.set(index, merge(usage.get(index), entry))
  }

  return usage
}
