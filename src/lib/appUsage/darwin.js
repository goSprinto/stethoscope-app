import { execFile } from 'child_process'
import { existsSync } from 'fs'
import log from '../logger'

// Spotlight attributes maintained by LaunchServices. kMDItemPath is requested so
// every record identifies the bundle it belongs to: mdls prints no per-file
// header, so without it the output can only be matched positionally.
const MDLS_ATTRIBUTES = ['kMDItemLastUsedDate', 'kMDItemPath', 'kMDItemUseCount']

// mdls stops processing at the first path it cannot read, losing every record
// after it. Batching bounds that loss and keeps the argument list under ARG_MAX.
const BATCH_SIZE = 50

// Spotlight reports bundle paths through the data volume firmlink, while the
// inventory holds the paths system_profiler reported.
const FIRMLINK_PREFIX = '/System/Volumes/Data'

const ATTRIBUTE_LINE = /^(kMDItem\w+)\s*=\s*(.*)$/

const NULL_MARKER = '(null)'

const chunk = (items, size) => {
  const batches = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

const runMdls = (args) =>
  new Promise((resolve, reject) => {
    execFile('mdls', args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      // an unreadable path makes mdls exit non-zero after printing the records it
      // did manage to read, so partial stdout is still worth parsing
      if (err && !stdout) return reject(err)
      resolve(stdout)
    })
  })

const parseValue = (raw) => {
  const value = raw.trim()
  if (!value || value === NULL_MARKER) return null
  const quoted = value.match(/^"(.*)"$/)
  return quoted ? quoted[1] : value
}

const toIsoDate = (raw) => {
  if (!raw) return null
  // mdls prints "2026-08-04 05:06:10 +0000"
  const time = Date.parse(raw)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

const toCount = (raw) => {
  if (!raw) return null
  const count = Number.parseInt(raw, 10)
  return Number.isNaN(count) ? null : count
}

const normalizePath = (path) =>
  path && path.startsWith(FIRMLINK_PREFIX)
    ? path.slice(FIRMLINK_PREFIX.length)
    : path

/**
 * mdls concatenates the attributes of every file it was given with no separator.
 * Each attribute appears exactly once per file -- as `(null)` when unset -- so a
 * key we have already collected marks the start of the next record.
 */
export const parseMdlsOutput = (stdout = '') => {
  const records = []
  let current = {}

  for (const line of stdout.split('\n')) {
    const match = line.match(ATTRIBUTE_LINE)
    if (!match) continue

    const [, key, rawValue] = match
    if (key in current) {
      records.push(current)
      current = {}
    }
    current[key] = parseValue(rawValue)
  }

  if (Object.keys(current).length) records.push(current)
  return records
}

/**
 * Reads last-launch time and cumulative launch count for the given applications.
 * Returns a Map keyed by the app's index in `apps`.
 */
export default async function getDarwinAppUsage (apps = []) {
  const usage = new Map()

  // mdls aborts the whole batch on a missing path, so drop anything that has
  // gone away since the inventory was collected
  const indexByPath = new Map()
  apps.forEach((app, index) => {
    if (app.path && existsSync(app.path)) {
      indexByPath.set(app.path, index)
    }
  })

  const attributeArgs = MDLS_ATTRIBUTES.reduce(
    (args, name) => args.concat('-name', name),
    []
  )

  for (const batch of chunk([...indexByPath.keys()], BATCH_SIZE)) {
    let stdout
    try {
      stdout = await runMdls(attributeArgs.concat(batch))
    } catch (e) {
      log.error('appUsage:darwin - mdls failed', {
        batchSize: batch.length,
        err: e && e.message ? e.message : String(e)
      })
      continue
    }

    for (const record of parseMdlsOutput(stdout)) {
      const path = normalizePath(record.kMDItemPath)
      const index = indexByPath.get(path)
      if (index === undefined) continue

      usage.set(index, {
        lastUsedAt: toIsoDate(record.kMDItemLastUsedDate),
        useCount: toCount(record.kMDItemUseCount)
      })
    }
  }

  return usage
}
