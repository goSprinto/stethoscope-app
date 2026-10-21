import { buildDiscoveredVendors } from './discoveredVendors'

describe('buildDiscoveredVendors', () => {
  it('sends only the application name', () => {
    const apps = [{ name: 'Cursor', version: '1.2.0', isRunning: true, lastUsedAt: '2026-10-01T00:00:00.000Z' }]

    expect(buildDiscoveredVendors(apps)).toEqual([{ applicationName: 'Cursor' }])
  })

  it('drops blank and duplicate names', () => {
    const apps = [{ name: ' Slack ' }, { name: 'Slack' }, { name: '' }, {}, null]

    expect(buildDiscoveredVendors(apps)).toEqual([{ applicationName: 'Slack' }])
  })

  it('returns nothing for an empty list', () => {
    expect(buildDiscoveredVendors([])).toEqual([])
  })
})
