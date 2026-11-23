import WindowsSecurity from './WindowsSecurity'
import { DEFAULT_WIN32_APP_REGISTRY_PATH } from '../../constants'
import kmd from '../../lib/kmd'

jest.mock('../../lib/kmd')

afterEach(() => {
  kmd.mockReset()
})

describe('Windows applications resolver', () => {
  it('refuses a registry path that could break out of the script quoting', async () => {
    global.log = { error: jest.fn() }
    kmd.mockResolvedValue({ apps: [] })

    const result = await WindowsSecurity.applications(
      null,
      [{ name: 'fooApp', paths: { win32: "HKLM\\Software' & calc.exe & '" } }],
      {}
    )
    expect(kmd).not.toHaveBeenCalled()
    expect(result).toEqual([{ name: 'fooApp', reason: 'NOT_INSTALLED' }])
  })

  it('matches app names as text, not as a regex', async () => {
    kmd.mockResolvedValue({ apps: [{ name: 'Foo App (x64)', version: '1.0.0' }] })

    const [plain] = await WindowsSecurity.applications(null, [{ name: 'foo app' }], {})
    expect(plain).toEqual({ name: 'foo app', version: '1.0.0' })

    const [regexLike] = await WindowsSecurity.applications(null, [{ name: '(a+)+$' }], {})
    expect(regexLike.reason).toBe('NOT_INSTALLED')
  })

  it('should pass (registry) path to kmd', async () => {
    const name = 'fooApp'
    const path = 'HKCU\\Software\\Vendor\\Uninstall'

    kmd.mockResolvedValue({
      apps: [
        {name: 'fooApp', version: '1.2.3'}
      ]
    })

    await WindowsSecurity.applications(
      null,
      [
        {
          name,
          paths: {
            win32: path
          },
          platform: {
            win32: ">=10.0"
          }
        }
      ],
      {}
    )
    expect(kmd.mock.calls[0][2]).toEqual({ REGISTRY_PATH: path })
  })

  it('should set a default path when not present', async () => {
    const name = 'fooApp'

    kmd.mockResolvedValue({
      apps: [
        {name: 'fooApp', version: '1.2.3'}
      ]
    })

    await WindowsSecurity.applications(
      null,
      [
        {
          name,
          platform: {
            win32: ">=10.0"
          }
        }
      ],
      {}
    )
    expect(kmd.mock.calls[0][2]).toEqual({ REGISTRY_PATH: DEFAULT_WIN32_APP_REGISTRY_PATH })
 })

  it('specifies reason when not installed', async () => {
    const name = 'fooApp'

    kmd.mockResolvedValue({
      apps: [
        {name: 'barSuite', version: '10.0.3'}
      ]
    })

    const result = await WindowsSecurity.applications(
      null,
      [
        {
          name,
          platform: {
            win32: ">=10.0"
          }
        }
      ],
      {}
    )

    expect(result[0].reason).toEqual("NOT_INSTALLED")
 })

  it('specifies reason when out of date', async () => {
    const name = 'fooApp'

    kmd.mockResolvedValue({
      apps: [
        {name: 'fooApp', version: '1.0.0'}
      ]
    })

    const result = await WindowsSecurity.applications(
      null,
      [
        {
          name,
          version: ">=2.0.0",
          platform: {
            win32: ">=10.0"
          }
        }
      ],
      {}
    )

    expect(result[0].reason).toEqual("OUT_OF_DATE")
 })
})
