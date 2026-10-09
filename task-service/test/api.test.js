const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')

process.env.JWT_SECRET = 'test-secret'
const app = require('../src/app')

let server
let base

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve)
  })
  base = `http://127.0.0.1:${server.address().port}`
})

after(() => server.close())

const bearer = (payload = { user_id: 1 }, secret = 'test-secret', opts = { algorithm: 'HS256' }) =>
  `Bearer ${jwt.sign(payload, secret, opts)}`

test('health is public', async () => {
  const res = await fetch(`${base}/health`)
  assert.equal(res.status, 200)
})

test('rejects requests without a token', async () => {
  const res = await fetch(`${base}/api/tasks`)
  assert.equal(res.status, 401)
})

test('rejects wrong secret, expired and non-HS256 tokens', async () => {
  const headers = [
    bearer({ user_id: 1 }, 'other'),
    bearer({ user_id: 1 }, 'test-secret', { algorithm: 'HS256', expiresIn: -10 }),
    bearer({ user_id: 1 }, 'test-secret', { algorithm: 'HS512' }),
  ]
  for (const Authorization of headers) {
    const res = await fetch(`${base}/api/tasks`, { headers: { Authorization } })
    assert.equal(res.status, 401)
  }
})

test('malformed task id returns 404 without touching the database', async () => {
  const res = await fetch(`${base}/api/tasks/not-an-id`, { headers: { Authorization: bearer() } })
  assert.equal(res.status, 404)
})

test('malformed JSON returns 400', async () => {
  const res = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { Authorization: bearer(), 'Content-Type': 'application/json' },
    body: '{',
  })
  assert.equal(res.status, 400)
})
