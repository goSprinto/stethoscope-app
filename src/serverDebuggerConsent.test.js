/**
 * @jest-environment node
 */
import { APP, ATTACKER, FIXED_HOST, TOKEN, WEB_APP, createLocalApiClient, resetAppActions, startLocalApi, stopLocalApi } from './testUtils/localApiServer'

jest.mock('./constants', () => ({ PORT: 38998 }))
jest.mock('kmd-script/src', () => ({ compile: jest.fn(), setKmdEnv: jest.fn(), run: jest.fn(async () => ({ device: { ok: true } })) }))
jest.mock('./lib/kmd', () => ({}))
jest.mock('./resolvers/', () => ({}))
jest.mock('@graphql-tools/schema', () => ({ makeExecutableSchema: jest.fn(() => ({})) }), { virtual: true })
jest.mock('graphql', () => ({ graphql: jest.fn() }))

const { request } = createLocalApiClient(38998)

describe('the /debugger route of the agent', () => {
  let server
  let appActions

  beforeAll(async () => {
    ({ server, appActions } = await startLocalApi())
  })

  afterAll(() => stopLocalApi(server))

  beforeEach(() => resetAppActions(appActions))

  describe('/debugger (V8-2207)', () => {
    const debuggerRequest = (origin, host) => request({ urlPath: '/debugger', headers: { ...(origin ? { Origin: origin } : {}), ...(host ? { Host: host } : {}) } })

    test.each([['the pinned Host', FIXED_HOST], ['the real Host', undefined]])('asks the user before an allowed web origin gets the log, with %s', async (_label, host) => {
      appActions.requestLogPermission.mockResolvedValue()

      const response = await debuggerRequest(WEB_APP, host)

      expect(appActions.requestLogPermission).toHaveBeenCalledTimes(1)
      expect(appActions.requestLogPermission).toHaveBeenCalledWith(WEB_APP)
      expect(response.status).toBe(200)
    })

    test('answers 403 and shares nothing when the user says no', async () => {
      appActions.requestLogPermission.mockRejectedValue(new Error('no'))

      const response = await debuggerRequest(WEB_APP, FIXED_HOST)

      expect(response.status).toBe(403)
      expect(response.body).not.toContain(TOKEN)
    })

    test('never hands out the token that older builds wrote to the log file', async () => {
      appActions.requestLogPermission.mockResolvedValue()

      const response = await debuggerRequest(WEB_APP, FIXED_HOST)

      expect(response.body).not.toContain(TOKEN)
      expect(response.body).toContain('[REDACTED]')
    })

    test.each([['the pinned Host', FIXED_HOST], ['the real Host', undefined]])('does not open DevTools for a remote caller, with %s', async (_label, host) => {
      appActions.requestLogPermission.mockResolvedValue()

      await debuggerRequest(WEB_APP, host)

      expect(appActions.enableDebugger).not.toHaveBeenCalled()
    })

    test('an origin that is not allowed gets no prompt and no log', async () => {
      const response = await debuggerRequest(ATTACKER, FIXED_HOST)

      expect(appActions.requestLogPermission).not.toHaveBeenCalled()
      expect(response.body).not.toContain(TOKEN)
      expect(response.body).not.toContain('DEVICE DATA')
    })

    test('a caller with no Origin is asked about, or refused, and never served silently', async () => {
      appActions.requestLogPermission.mockRejectedValue(new Error('no'))

      const response = await debuggerRequest(undefined, FIXED_HOST)

      expect(response.body).not.toContain('DEVICE DATA')
    })

    test("the app's own renderer gets the log without a prompt, with the token redacted", async () => {
      const response = await debuggerRequest(APP, FIXED_HOST)

      expect(appActions.requestLogPermission).not.toHaveBeenCalled()
      expect(response.status).toBe(200)
      expect(response.body).not.toContain(TOKEN)
    })
  })
})
