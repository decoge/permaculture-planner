/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, test } from '@jest/globals'
import {
  createSessionToken,
  verifySessionToken,
  sessionMaxAgeSeconds,
  type SessionPayload,
} from '@/lib/auth/token'

const base: Omit<SessionPayload, 'exp'> = {
  sub: 'user-1',
  email: 'gardener@example.com',
  name: 'Ada',
  isAdmin: false,
  tokenVersion: 3,
}

describe('session tokens', () => {
  // Next types NODE_ENV as readonly, but the suite needs to simulate the
  // production branch of getSessionSecret().
  const env = process.env as Record<string, string | undefined>

  beforeEach(() => {
    env.SESSION_SECRET = 'test-secret-value'
    env.NODE_ENV = 'test'
  })

  test('round-trips a valid token', async () => {
    const token = await createSessionToken(base)
    const payload = await verifySessionToken(token)

    expect(payload).toMatchObject(base)
  })

  test('rejects a token signed with a different secret', async () => {
    const token = await createSessionToken(base)

    process.env.SESSION_SECRET = 'a-completely-different-secret'
    await expect(verifySessionToken(token)).resolves.toBeNull()
  })

  test('rejects a tampered payload', async () => {
    const token = await createSessionToken(base)
    const [body, signature] = token.split('.')
    const decoded = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload

    // Escalate to admin without re-signing.
    decoded.isAdmin = true
    const forged = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${signature}`

    await expect(verifySessionToken(forged)).resolves.toBeNull()
  })

  test('rejects a payload signed for a different user', async () => {
    const token = await createSessionToken({ ...base, sub: 'user-2' })
    const [body, signature] = token.split('.')
    // Swap in another user's body, keeping the original signature.
    const other = Buffer.from(
      JSON.stringify({ ...base, sub: 'victim', exp: Math.floor(Date.now() / 1000) + 999 })
    ).toString('base64url')

    await expect(verifySessionToken(`${other}.${signature}`)).resolves.toBeNull()
    expect(body).not.toBe(other)
  })

  test('rejects an expired token', async () => {
    const token = await createSessionToken(base)
    const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()) as SessionPayload
    expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000))

    // Verify against a clock far in the future without re-signing.
    const realNow = Date.now
    Date.now = () => realNow() + (sessionMaxAgeSeconds + 60) * 1000
    try {
      await expect(verifySessionToken(token)).resolves.toBeNull()
    } finally {
      Date.now = realNow
    }
  })

  test('rejects malformed tokens without throwing', async () => {
    for (const bad of ['', '.', 'no-signature', 'a.b.c', '...', 'a.']) {
      await expect(verifySessionToken(bad)).resolves.toBeNull()
    }
  })

  test('returns null when no secret is configured in production', async () => {
    const token = await createSessionToken(base)

    delete env.SESSION_SECRET
    const realEnv = env.NODE_ENV
    env.NODE_ENV = 'production'
    try {
      await expect(verifySessionToken(token)).resolves.toBeNull()
    } finally {
      env.SESSION_SECRET = 'test-secret-value'
      env.NODE_ENV = realEnv
    }
  })
})