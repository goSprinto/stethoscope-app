// A simple test to verify a visible window is opened with a title
const { _electron: electron } = require('playwright-core')
const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const pkg = require('../../package.json')

const configHandle = fs.readFileSync(path.resolve(__dirname, '../practices/config.yaml'), 'utf8')
const config = yaml.load(configHandle)

const policyHandle = fs.readFileSync(path.resolve(__dirname, '../__tests__/policy-test.yaml'), 'utf8')
const policy = yaml.load(policyHandle)

policy.stethoscopeVersion = `>=${pkg.version}`

// electron-builder only suffixes the output dir with the arch for non-x64 builds
const archSuffix = process.arch === 'x64' ? '' : `-${process.arch}`
const paths = {
  darwin: `dist/mac${archSuffix}/${pkg.name}.app/Contents/MacOS/${pkg.name}`,
  win32: `dist/win${archSuffix}-unpacked/${pkg.name}.exe`,
  linux: `dist/linux${archSuffix}-unpacked/${pkg.name.toLowerCase()}`
}
const executablePath = path.resolve(__dirname, '../..', paths[process.platform])

// a cross-platform build (e.g. build:linux on macOS) can't be launched on this host
if (!fs.existsSync(executablePath)) {
  const hostPrefix = { darwin: 'mac', win32: 'win', linux: 'linux' }[process.platform]
  const builds = fs.existsSync('dist')
    ? fs.readdirSync('dist').filter(f => /^(mac|win|linux)(-|$)/.test(f))
    : []
  if (builds.length && !builds.some(f => f.startsWith(hostPrefix))) {
    console.log(`Skipping smoke test: dist only has ${builds.join(', ')}, which can't run on ${process.platform}-${process.arch}`)
    process.exit(0)
  }
}

const appName = fs.readFileSync(path.resolve(__dirname, '../../.env'), 'utf8')
  .match(/^REACT_APP_NAME=(.*)$/m)[1].trim()

let app

// DevicePolicy.osVersion is a list of named brackets, the yaml is keyed by platform
policy.osVersion = {
  platforms: Object.entries(policy.osVersion).map(([name, bracket]) => ({ name, ...bracket }))
}

const VALIDATE_DEVICE = `query ValidateDevice($policy: DevicePolicy!) {
  policy {
    validate(policy: $policy) {
      status
      osVersion
      diskEncryption
      screenLock
      screenIdle
      antivirus
      stethoscopeVersion
    }
  }
  device {
    deviceId
    deviceName
    platform
    platformName
    osVersion
    osName
    hardwareModel
    hardwareSerial
    stethoscopeVersion
    security(policy: $policy) {
      diskEncryption
      screenLock
      screenIdle
    }
  }
}`

// resolves to the graphql response, or false if the request was rejected or errored
async function scan (origin) {
  try {
    const res = await fetch('http://127.0.0.1:37370/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ query: VALIDATE_DEVICE, variables: { policy } })
    })
    if (!res.ok) return false
    const response = await res.json()
    return response.errors ? false : response
  } catch (e) {
    return false
  }
}

function round (n) {
  return Math.round(n * 100) / 100
}

function standardDeviation (values) {
  const avg = average(values)
  const squareDiffs = values.map(value => {
    const diff = value - avg
    return diff * diff
  })

  const avgSquareDiff = average(squareDiffs)

  return Math.sqrt(avgSquareDiff)
}

function average (data) {
  const sum = data.reduce((sum, value) => sum + value, 0)
  return sum / data.length
}

console.log('\n========================== STETHOSCOPE SMOKE TEST ==========================')

async function main () {
  try {
    app = await electron.launch({
      executablePath,
      args: [path.join(__dirname, '..'), 'testMode']
    })
    const window = await app.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    console.log('\n============================ STANDALONE TESTS ============================\n')

    const isVisible = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible())
    assert.strict.equal(isVisible, true)
    console.log('✓', 'app is visible')

    const title = await window.title()
    assert.strict.equal(title, `${appName} (v${pkg.version})`)
    console.log('✓', 'correct version in title')

    const devToolsOpen = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.isDevToolsOpened())
    assert.strict.equal(devToolsOpen, false)
    console.log('✓', 'dev tools are closed')

    await window.getByRole('button', { name: 'Scan', exact: true }).waitFor({ timeout: 30000 })
    console.log('✓', 'app scan successful')

    // the app's CSP blocks inline <script> tags but allows eval
    await window.evaluate(require('axe-core').source)
    const { violations } = await window.evaluate(() => window.axe.run())
    violations.forEach(v => console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`))
    // only critical violations fail the build, the rest are reported above
    const critical = violations.filter(v => v.impact === 'critical')
    assert.strict.equal(critical.length, 0, `${critical.length} critical accessibility violation(s)`)
    console.log('✓', 'app passes accessibility audit')

    console.log('\n============================ REMOTE SCANNING ============================\n')

    const response = await scan('drsprinto://main')
    assert.ok(response, "scan from trusted 'drsprinto://main' failed")
    {
      const timing = Math.round(response.extensions.timing.total / 1000 * 100) / 100
      console.log('✓', `[Remote:Application]\tscan from trusted 'drsprinto://main' successful\t${`${timing} seconds`}`)
    }

    assert.strict.equal(await scan('https://malicious.ru'), false, "scan from untrusted 'https://malicious.ru' succeeded")
    {
      console.log('✓', '[Remote:Untrusted]\tscan from untrusted \'https://malicious.ru\' failed')
    }

    if (config.testHosts && Array.isArray(config.testHosts)) {
      for (const { url, label } of config.testHosts) {
        const response = await scan(url)
        if (response !== false) {
          const timing = Math.round(response.extensions.timing.total / 1000 * 100) / 100
          console.log('✓', `[Remote:${label}]\tscan from test URL '${url}' successful\t${`${timing} seconds`}`)
        } else {
          console.log('x', `${url} - ${label} failed`)
        }
      }
    }

    const LOAD = 30
    const timings = []

    console.log('\n============================ LOAD TESTS ============================\n')

    for (let i = 0; i < LOAD; i++) {
      const response = await scan('drsprinto://main')
      assert.ok(response, `load test scan ${i + 1} failed`)
      const timing = Math.round(response.extensions.timing.total / 1000 * 100) / 100
      timings.push(timing)
      console.log('✓', `[LOADTEST ${i + 1}]\tscan took ${timing} seconds`)
      // await sleep(.5)
    }

    timings.sort()

    const totalProcessingTime = timings.reduce((p, c) => p + parseFloat(c), 0)

    console.log('\n', '✓', 'load test passed\n')
    console.log(`Load timing (seconds) for ${LOAD} requests:\n`)

    console.log('\t', 'Average:\t', round(average(timings)))
    console.log('\t', 'SD:\t\t', round(standardDeviation(timings)))
    console.log('\t', 'Longest:\t', timings[timings.length - 1])
    console.log('\t', 'Shortest:\t', timings[0])
    console.log('\t', 'Total:\t\t', round(totalProcessingTime))

    console.log('\n', '✓', 'ALL TESTS PASSED!')

    await app.close()
    process.exit(0)
  } catch (e) {
    console.error('X', 'Test failed', e.message)
    if (app) await app.close()
    process.exit(1)
  }
}

main()
