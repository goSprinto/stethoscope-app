import { execFile } from 'child_process'
import getWin32AppUsage, { readUserAssistEntries } from './win32'

jest.mock('child_process')
// the real logger pulls in electron, which cannot load under jest
jest.mock('../logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() }
}))

const EXECUTABLE_KEY =
  'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist\\{CEBFF5CD-ACE2-4F4F-9178-9926F41749EA}\\Count'
const SHORTCUT_KEY =
  'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist\\{F4E57C4B-2036-45F0-A9AB-443BCFE33D9F}\\Count'
const UI_COUNT_KEY =
  'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\UserAssist\\{9E04CAB2-CC14-11DF-BB8C-A2F1DED72085}\\Count'

const rot13 = (value) =>
  value.replace(/[a-zA-Z]/g, (char) => {
    const code = char.charCodeAt(0)
    const base = code < 97 ? 65 : 97
    return String.fromCharCode(((code - base + 13) % 26) + base)
  })

const FILETIME_EPOCH_OFFSET_MS = 11644473600000n

/** Builds the 72-byte record Windows 7+ writes for a UserAssist entry. */
const buildRecord = (runCount, isoDate) => {
  const buffer = Buffer.alloc(72)
  buffer.writeUInt32LE(runCount, 4)
  if (isoDate) {
    const filetime =
      (BigInt(Date.parse(isoDate)) + FILETIME_EPOCH_OFFSET_MS) * 10000n
    buffer.writeBigUInt64LE(filetime, 60)
  }
  return buffer.toString('hex').toUpperCase()
}

const valueLine = (path, runCount, isoDate) =>
  `    ${rot13(path)}    REG_BINARY    ${buildRecord(runCount, isoDate)}`

const mockReg = (stdout, err = null) => {
  execFile.mockImplementation((cmd, args, opts, cb) => cb(err, stdout))
}

beforeEach(() => jest.resetAllMocks())

describe('readUserAssistEntries', () => {
  it('decodes the ROT13 name and the binary record', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine('C:\\Program Files\\Slack\\slack.exe', 12, '2026-08-04T05:06:10.000Z'),
        ''
      ].join('\r\n')
    )

    const entries = await readUserAssistEntries()

    expect(entries).toEqual([
      {
        path: 'C:\\Program Files\\Slack\\slack.exe',
        useCount: 12,
        lastUsedAt: '2026-08-04T05:06:10.000Z'
      }
    ])
  })

  it('expands the known folder GUID entries are stored under', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine(
          '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}\\Slack\\slack.exe',
          3,
          '2026-08-01T00:00:00.000Z'
        ),
        ''
      ].join('\r\n')
    )

    const [entry] = await readUserAssistEntries()

    expect(entry.path).toBe('C:\\Program Files (x86)\\Slack\\slack.exe')
  })

  it('leaves an unrecognised GUID alone instead of guessing', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine('{11111111-2222-3333-4444-555555555555}\\thing.exe', 1, null),
        ''
      ].join('\r\n')
    )

    const [entry] = await readUserAssistEntries()

    expect(entry.path).toBe('{11111111-2222-3333-4444-555555555555}\\thing.exe')
  })

  it('reads both the executable and shortcut sections', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine('C:\\Apps\\a.exe', 1, '2026-08-01T00:00:00.000Z'),
        SHORTCUT_KEY,
        valueLine('C:\\Apps\\b.lnk', 2, '2026-08-02T00:00:00.000Z'),
        ''
      ].join('\r\n')
    )

    const entries = await readUserAssistEntries()

    expect(entries.map((e) => e.path)).toEqual(['C:\\Apps\\a.exe', 'C:\\Apps\\b.lnk'])
  })

  it('ignores the sections that count UI elements rather than launches', async () => {
    mockReg(
      [
        UI_COUNT_KEY,
        valueLine('Microsoft.Windows.Explorer', 99, '2026-08-01T00:00:00.000Z'),
        ''
      ].join('\r\n')
    )

    expect(await readUserAssistEntries()).toEqual([])
  })

  it('reports an unset timestamp as unknown', async () => {
    mockReg([EXECUTABLE_KEY, valueLine('C:\\Apps\\a.exe', 5, null), ''].join('\r\n'))

    const [entry] = await readUserAssistEntries()

    expect(entry.lastUsedAt).toBeNull()
    expect(entry.useCount).toBe(5)
  })

  it('skips a record too short to hold the fields it needs', async () => {
    mockReg(
      [EXECUTABLE_KEY, `    ${rot13('C:\\Apps\\a.exe')}    REG_BINARY    00000000`, ''].join(
        '\r\n'
      )
    )

    expect(await readUserAssistEntries()).toEqual([])
  })
})

describe('getWin32AppUsage', () => {
  it('attributes a launch to the app it was installed under', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine('C:\\Program Files\\Slack\\slack.exe', 12, '2026-08-04T05:06:10.000Z'),
        ''
      ].join('\r\n')
    )

    const usage = await getWin32AppUsage([
      { name: 'Slack', path: 'C:\\Program Files\\Slack' }
    ])

    expect(usage.get(0)).toEqual({
      useCount: 12,
      lastUsedAt: '2026-08-04T05:06:10.000Z'
    })
  })

  it('sums the launches of an app with several binaries and shortcuts', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine('C:\\Program Files\\Slack\\slack.exe', 10, '2026-08-01T00:00:00.000Z'),
        valueLine('C:\\Program Files\\Slack\\updater.exe', 5, '2026-08-04T00:00:00.000Z'),
        ''
      ].join('\r\n')
    )

    const usage = await getWin32AppUsage([
      { name: 'Slack', path: 'C:\\Program Files\\Slack' }
    ])

    // the most recent launch of any of them is when the app was last used
    expect(usage.get(0)).toEqual({
      useCount: 15,
      lastUsedAt: '2026-08-04T00:00:00.000Z'
    })
  })

  it('prefers a nested install over its parent directory', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine(
          'C:\\Program Files\\Vendor\\Suite\\app.exe',
          7,
          '2026-08-04T00:00:00.000Z'
        ),
        ''
      ].join('\r\n')
    )

    const usage = await getWin32AppUsage([
      { name: 'Vendor Tools', path: 'C:\\Program Files\\Vendor' },
      { name: 'Suite', path: 'C:\\Program Files\\Vendor\\Suite' }
    ])

    expect(usage.has(0)).toBe(false)
    expect(usage.get(1).useCount).toBe(7)
  })

  it('falls back to the launched file name when there is no install location', async () => {
    mockReg(
      [
        SHORTCUT_KEY,
        valueLine('C:\\Users\\rafi\\Desktop\\Slack.lnk', 4, '2026-08-04T00:00:00.000Z'),
        ''
      ].join('\r\n')
    )

    const usage = await getWin32AppUsage([{ name: 'Slack', path: null }])

    expect(usage.get(0).useCount).toBe(4)
  })

  it('does not let a drive root swallow every launch on the machine', async () => {
    mockReg(
      [
        EXECUTABLE_KEY,
        valueLine('C:\\Program Files\\Other\\other.exe', 3, '2026-08-04T00:00:00.000Z'),
        ''
      ].join('\r\n')
    )

    const usage = await getWin32AppUsage([{ name: 'Bad Installer', path: 'C:\\' }])

    expect(usage.size).toBe(0)
  })

  it('leaves an app with no launch record as unknown', async () => {
    mockReg([EXECUTABLE_KEY, ''].join('\r\n'))

    const usage = await getWin32AppUsage([
      { name: 'Never Launched', path: 'C:\\Program Files\\Thing' }
    ])

    expect(usage.size).toBe(0)
  })

  it('returns an empty map when the registry cannot be read', async () => {
    mockReg('', { message: 'exit 1' })

    const usage = await getWin32AppUsage([
      { name: 'Slack', path: 'C:\\Program Files\\Slack' }
    ])

    expect(usage.size).toBe(0)
  })
})
