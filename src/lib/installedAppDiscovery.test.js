import {
  isInstalledAppDiscoveryEnabled,
  updateInstalledAppDiscovery,
  disableInstalledAppDiscovery
} from './installedAppDiscovery'

jest.mock('electron-store', () => {
  const values = {}
  return jest.fn().mockImplementation(() => ({
    get: (key) => values[key],
    set: (key, value) => { values[key] = value }
  }))
})

describe('installedAppDiscovery', () => {
  beforeEach(() => disableInstalledAppDiscovery())

  it('is off until Sprinto says otherwise', () => {
    expect(isInstalledAppDiscoveryEnabled()).toBe(false)
  })

  it('turns on only for an explicit true', () => {
    updateInstalledAppDiscovery({ installedAppDiscovery: true })

    expect(isInstalledAppDiscoveryEnabled()).toBe(true)
  })

  it.each([
    ['no settings from an older server', undefined],
    ['settings without the field', {}],
    ['an explicit false', { installedAppDiscovery: false }],
    ['a truthy non-boolean', { installedAppDiscovery: 'true' }]
  ])('stays off for %s', (_label, remoteSettings) => {
    updateInstalledAppDiscovery({ installedAppDiscovery: true })
    updateInstalledAppDiscovery(remoteSettings)

    expect(isInstalledAppDiscoveryEnabled()).toBe(false)
  })

  it('turns off when disabled', () => {
    updateInstalledAppDiscovery({ installedAppDiscovery: true })
    disableInstalledAppDiscovery()

    expect(isInstalledAppDiscoveryEnabled()).toBe(false)
  })
})
