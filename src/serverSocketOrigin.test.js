/**
 * @jest-environment node
 */
import { knownGap } from './testUtils/knownGap'
import { APP, ATTACKER, TOKEN, WEB_APP, createLocalApiClient, resetAppActions, startLocalApi, stopLocalApi } from './testUtils/localApiServer'

jest.mock('./constants', () => ({ PORT: 38999 }))
jest.mock('kmd-script/src', () => ({ compile: jest.fn(), setKmdEnv: jest.fn(), run: jest.fn(async () => ({ device: { ok: true } })) }))
jest.mock('./lib/kmd', () => ({}))
jest.mock('./resolvers/', () => ({}))
jest.mock('@graphql-tools/schema', () => ({ makeExecutableSchema: jest.fn(() => ({})) }), { virtual: true })
jest.mock('graphql', () => ({ graphql: jest.fn() }))

const { request, connect, waitForMessage } = createLocalApiClient(38999)

describe('the local socket.io of the agent', () => {
  let server
  let appActions

  beforeAll(async () => {
    ({ server, appActions } = await startLocalApi())
  })

  afterAll(() => stopLocalApi(server))

  beforeEach(() => resetAppActions(appActions))

  describe('socket.io (V8-2205)', () => {
    test.each([
      ['a web page on an attacker origin', ATTACKER],
      ['the Sprinto web app origin', WEB_APP],
      ['a local dev origin', 'http://127.0.0.1:8899'],
      ['a request with no Origin', undefined]
    ])('refuses a websocket from %s', async (_label, origin) => {
      const { socket, connected } = await connect(origin)
      socket.terminate()
      expect(connected).toBe(false)
    })

    test.each([['a web page on an attacker origin', ATTACKER], ['a request with no Origin', undefined]])(
      'refuses HTTP polling from %s',
      async (_label, origin) => {
        const response = await request({ urlPath: '/socket.io/?EIO=4&transport=polling', headers: origin ? { Origin: origin } : {} })
        expect(response.status).toBeGreaterThanOrEqual(400)
        expect(response.body).not.toContain('sid')
      }
    )

    test("lets the app's own renderer open an HTTP polling session", async () => {
      const response = await request({ urlPath: '/socket.io/?EIO=4&transport=polling', headers: { Origin: APP } })
      expect(response.status).toBe(200)
      expect(response.body).toContain('sid')
    })

    test("lets the app's own renderer connect, and listen to the events", async () => {
      const { socket, connected, messages } = await connect(APP)
      expect(connected).toBe(true)
      await request({
        method: 'POST',
        urlPath: '/connect',
        headers: { Origin: APP, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: TOKEN, baseUrl: WEB_APP, firstName: 'Lab' })
      })
      const event = await waitForMessage(messages, 'sprinto:deviceConnected')
      socket.terminate()
      expect(event).not.toBeNull()
    })

    // The ticket's fix list also asks that the token never goes into a socket event
    knownGap('[RED] GAP: the device token is not put into the sprinto:deviceConnected event', async () => {
      const { socket, messages } = await connect(APP)
      await request({
        method: 'POST',
        urlPath: '/connect',
        headers: { Origin: APP, 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: TOKEN, baseUrl: WEB_APP, firstName: 'Lab' })
      })
      const event = await waitForMessage(messages, 'sprinto:deviceConnected')
      socket.terminate()
      expect(event, 'the event must arrive for the check to mean anything').not.toBeNull()
      expect(JSON.stringify(event)).not.toContain(TOKEN)
    })
  })
})
