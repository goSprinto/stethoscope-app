import { execFile } from 'child_process'
import { existsSync } from 'fs'
import getDarwinAppUsage, { parseMdlsOutput } from './darwin'

jest.mock('child_process')
jest.mock('fs')
// the real logger pulls in electron, which cannot load under jest
jest.mock('../logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
}))

const record = (lastUsed, path, useCount) =>
  [
    `kMDItemLastUsedDate = ${lastUsed}`,
    `kMDItemPath         = "${path}"`,
    `kMDItemUseCount     = ${useCount}`
  ].join('\n')

beforeEach(() => {
  jest.resetAllMocks()
  existsSync.mockReturnValue(true)
})

const mockMdls = (stdout, err = null) => {
  execFile.mockImplementation((cmd, args, opts, cb) => cb(err, stdout))
}

describe('parseMdlsOutput', () => {
  it('splits the concatenated output into one record per file', () => {
    const records = parseMdlsOutput(
      [
        record('2026-08-04 05:06:10 +0000', '/Applications/Slack.app', '1185'),
        record('(null)', '/Applications/Cursor.app', '(null)')
      ].join('\n')
    )

    expect(records).toHaveLength(2)
    expect(records[0].kMDItemPath).toBe('/Applications/Slack.app')
    expect(records[0].kMDItemUseCount).toBe('1185')
    expect(records[1].kMDItemLastUsedDate).toBeNull()
    expect(records[1].kMDItemUseCount).toBeNull()
  })

  it('ignores lines that are not attributes', () => {
    const output = [
      '/Applications/Slack.app: could not find /Applications/Gone.app.',
      record('2026-08-04 05:06:10 +0000', '/Applications/Slack.app', '3')
    ].join('\n')

    expect(parseMdlsOutput(output)).toHaveLength(1)
  })

  it('returns nothing for empty output', () => {
    expect(parseMdlsOutput('')).toEqual([])
  })
})

describe('getDarwinAppUsage', () => {
  it('keys usage by the index of the app it belongs to', async () => {
    mockMdls(
      [
        record('2026-08-04 05:06:10 +0000', '/Applications/Slack.app', '1185'),
        record('2026-08-03 13:02:36 +0000', '/Applications/Safari.app', '7')
      ].join('\n')
    )

    const usage = await getDarwinAppUsage([
      { name: 'Slack', path: '/Applications/Slack.app' },
      { name: 'Safari', path: '/Applications/Safari.app' }
    ])

    expect(usage.get(0)).toEqual({
      lastUsedAt: '2026-08-04T05:06:10.000Z',
      useCount: 1185
    })
    expect(usage.get(1)).toEqual({
      lastUsedAt: '2026-08-03T13:02:36.000Z',
      useCount: 7
    })
  })

  it('strips the data volume firmlink Spotlight reports paths through', async () => {
    mockMdls(
      record(
        '2026-08-04 05:06:10 +0000',
        '/System/Volumes/Data/Applications/Slack.app',
        '2'
      )
    )

    const usage = await getDarwinAppUsage([
      { name: 'Slack', path: '/Applications/Slack.app' }
    ])

    expect(usage.get(0).useCount).toBe(2)
  })

  it('reports unknown rather than zero when the metadata was reset', async () => {
    mockMdls(record('(null)', '/Applications/Cursor.app', '(null)'))

    const usage = await getDarwinAppUsage([
      { name: 'Cursor', path: '/Applications/Cursor.app' }
    ])

    expect(usage.get(0)).toEqual({ lastUsedAt: null, useCount: null })
  })

  it('never attributes a record to the wrong app when a path is missing', async () => {
    // mdls stops at the first unreadable path, so Safari's record is absent
    existsSync.mockImplementation((path) => !path.includes('Gone'))
    mockMdls(
      '/Applications/Slack.app: could not find /Applications/Gone.app.\n' +
        record('2026-08-04 05:06:10 +0000', '/Applications/Slack.app', '4')
    )

    const usage = await getDarwinAppUsage([
      { name: 'Slack', path: '/Applications/Slack.app' },
      { name: 'Gone', path: '/Applications/Gone.app' },
      { name: 'Safari', path: '/Applications/Safari.app' }
    ])

    expect(usage.get(0).useCount).toBe(4)
    expect(usage.has(1)).toBe(false)
    expect(usage.has(2)).toBe(false)
  })

  it('skips apps whose bundle no longer exists', async () => {
    existsSync.mockReturnValue(false)

    const usage = await getDarwinAppUsage([
      { name: 'Gone', path: '/Applications/Gone.app' }
    ])

    expect(execFile).not.toHaveBeenCalled()
    expect(usage.size).toBe(0)
  })

  it('keeps the records mdls printed before it failed', async () => {
    mockMdls(record('2026-08-04 05:06:10 +0000', '/Applications/Slack.app', '9'), {
      message: 'exit 1'
    })

    const usage = await getDarwinAppUsage([
      { name: 'Slack', path: '/Applications/Slack.app' }
    ])

    expect(usage.get(0).useCount).toBe(9)
  })

  it('returns an empty map when mdls produces nothing at all', async () => {
    mockMdls('', { message: 'spawn mdls ENOENT' })

    const usage = await getDarwinAppUsage([
      { name: 'Slack', path: '/Applications/Slack.app' }
    ])

    expect(usage.size).toBe(0)
  })

  it('batches large inventories so one bad path cannot lose everything', async () => {
    mockMdls('')
    const apps = Array.from({ length: 120 }, (_, i) => ({
      name: `App${i}`,
      path: `/Applications/App${i}.app`
    }))

    await getDarwinAppUsage(apps)

    expect(execFile).toHaveBeenCalledTimes(3)
  })
})
