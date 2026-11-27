import http from 'http'
import WebSocket from 'ws'
import fs from 'fs'
import os from 'os'
import path from 'path'

export const TOKEN = 'LAB-TOKEN-6f1d2c'
export const APP = 'drsprinto://main'
export const WEB_APP = 'https://app.sprinto.com'
export const ATTACKER = 'https://sprinto.com.attacker.tld'
export const FIXED_HOST = '127.0.0.1:37370'

// Starts the real server.js. Each test file mocks ./constants with its own PORT, so two files can run side by side.
export const startLocalApi = async () => {
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stetho-')), 'app.log')
  fs.writeFileSync(logFile, `2026-11-19T10:00:00Z error - {"headers":{"Authorization":"Bearer ${TOKEN}"}}\n`)
  const log = { info () {}, warn () {}, error () {}, debug () {}, getLogFile: () => logFile }
  const appActions = {
    requestLogPermission: jest.fn(),
    enableDebugger: jest.fn(),
    openDevTools: jest.fn(),
    confirmConnect: jest.fn(async () => {}),
    verifyConnection: jest.fn(async () => ({ ok: true })),
    showConnectError: jest.fn(),
    confirmDisconnect: jest.fn(async () => {})
  }
  delete process.env.STETHOSCOPE_ENV
  const startServer = require('../server').default
  const server = await startServer({}, log, 'en-US', appActions)
  return { server, appActions }
}

export const stopLocalApi = (server) => {
  server.close()
  if (server.closeAllConnections) server.closeAllConnections()
}

export const resetAppActions = (appActions) => {
  appActions.requestLogPermission.mockReset()
  appActions.enableDebugger.mockReset()
  appActions.confirmConnect.mockImplementation(async () => {})
  appActions.verifyConnection.mockImplementation(async () => ({ ok: true }))
  appActions.confirmDisconnect.mockImplementation(async () => {})
}

export const createLocalApiClient = (port) => {
  const request = ({ method = 'GET', urlPath, headers = {}, body }) =>
    new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port, path: urlPath, method, headers: body ? { ...headers, 'Content-Length': Buffer.byteLength(body) } : headers }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
      })
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    })

  // Raw engine.io v4 handshake, as in the ticket: the browser sends the page's Origin on a websocket upgrade
  const connect = (origin) =>
    new Promise((resolve) => {
      const messages = []
      const socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`, { headers: origin ? { Origin: origin } : {} })
      const finish = (connected) => resolve({ socket, connected, messages })
      socket.on('message', (data) => {
        const text = String(data)
        messages.push(text)
        if (text.startsWith('0')) {
          socket.send('40')
        } else if (text.startsWith('40')) {
          finish(true)
        }
      })
      socket.on('unexpected-response', () => finish(false))
      socket.on('error', () => finish(false))
      socket.on('close', () => finish(false))
      setTimeout(() => finish(false), 3000)
    })

  const waitForMessage = (messages, needle, ms = 3000) =>
    new Promise((resolve) => {
      const started = Date.now()
      const tick = () => {
        const found = messages.find((text) => text.includes(needle))
        if (found) return resolve(found)
        if (Date.now() - started > ms) return resolve(null)
        setTimeout(tick, 25)
      }
      tick()
    })

  return { request, connect, waitForMessage }
}
