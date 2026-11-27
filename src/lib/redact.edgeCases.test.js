import redact, { describeError } from './redact'
import { knownGap } from '../testUtils/knownGap'

const TOKEN = 'LAB-TOKEN-6f1d2c'

describe('redact: shapes a log line can take', () => {
  it.each([
    ['a bearer token inside a JSON string that was stringified twice', `{"err":"{\\"headers\\":{\\"Authorization\\":\\"Bearer ${TOKEN}\\"}}"}`],
    ['a lower-case scheme', `authorization: bearer ${TOKEN}`],
    ['an upper-case scheme', `Authorization: BEARER ${TOKEN}`],
    ['a token with base64 characters', `Authorization: Bearer ${TOKEN}+/=`],
    ['a pretty-printed multi-line message', `{\n  "headers": {\n    "Authorization": "Bearer ${TOKEN}"\n  }\n}`],
    ['two tokens on one line', `Bearer ${TOKEN} and then Bearer ${TOKEN}`],
    ['an access token query parameter', `https://x.example/cb?access_token=${TOKEN}&x=1`]
  ])('removes the token from %s', (_label, line) => {
    expect(redact(line)).not.toContain(TOKEN)
  })

  // The old build wrote the whole request body as a string inside an object, so quotes are escaped
  knownGap('[RED] GAP: removes an access token whose JSON quotes are escaped', () => {
    expect(redact(`{"err":"{\\"accessToken\\":\\"${TOKEN}\\",\\"baseUrl\\":\\"https://app.sprinto.com\\"}"}`)).not.toContain(TOKEN)
  })
})

describe('describeError', () => {
  it('keeps a bearer token that is inside the error message out of the redacted log line', () => {
    const err = new Error(`HTTP error 401 for Bearer ${TOKEN}`)

    expect(redact(JSON.stringify(describeError(err)))).not.toContain(TOKEN)
  })

  it('copes with an error that has no response or config', () => {
    expect(describeError(new Error('offline'))).toEqual({ message: 'offline', code: undefined, status: undefined })
  })
})
