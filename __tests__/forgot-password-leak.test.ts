/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const createPasswordReset = jest.fn<(email: string) => Promise<string | null>>()

jest.mock('@/lib/db/users', () => ({
  createPasswordReset: (email: string) => createPasswordReset(email),
}))

const TOKEN = 'super-secret-reset-token'

/**
 * NODE_ENV is typed readonly by @types/node, but the route branches on it and
 * the difference is the whole point of these tests. Assign through a cast so
 * the value can be flipped per case.
 */
function setNodeEnv(value: string) {
  ;(process.env as Record<string, string | undefined>).NODE_ENV = value
}

function post(email: string) {
  return new Request('http://localhost:3000/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

describe('forgot-password does not leak the reset token in production', () => {
  const originalEnv = process.env.NODE_ENV
  let info: jest.SpiedFunction<typeof console.info>
  let error: jest.SpiedFunction<typeof console.error>

  beforeEach(() => {
    createPasswordReset.mockReset()
    createPasswordReset.mockResolvedValue(TOKEN)
    info = jest.spyOn(console, 'info').mockImplementation(() => {})
    error = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setNodeEnv(originalEnv ?? 'test')
    info.mockRestore()
    error.mockRestore()
  })

  test('omits the resetUrl from the response in production', async () => {
    setNodeEnv('production')
    const { POST } = await import('@/app/api/auth/forgot-password/route')

    const response = await POST(post('user@example.com') as never)
    const body = await response.json()

    expect(response.status).toBe(200)
    // The whole point: an endpoint that accepts any address must not hand back
    // a working token for the account it found.
    expect(body.resetUrl).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(TOKEN)
  })

  test('does not write the token to the log in production', async () => {
    setNodeEnv('production')
    const { POST } = await import('@/app/api/auth/forgot-password/route')

    await POST(post('user@example.com') as never)

    const logged = [info, error].flatMap((spy) =>
      spy.mock.calls.map((call) => call.map(String).join(' '))
    )
    for (const line of logged) expect(line).not.toContain(TOKEN)
  })

  test('returns the resetUrl in development so the flow is usable', async () => {
    setNodeEnv('development')
    const { POST } = await import('@/app/api/auth/forgot-password/route')

    const response = await POST(post('user@example.com') as never)
    const body = await response.json()

    expect(body.resetUrl).toContain(TOKEN)
  })

  test('the response is identical for a known and an unknown address', async () => {
    setNodeEnv('production')
    const { POST } = await import('@/app/api/auth/forgot-password/route')

    createPasswordReset.mockResolvedValueOnce(TOKEN).mockResolvedValueOnce(null)

    const known = await (await POST(post('real@example.com') as never)).json()
    const unknown = await (await POST(post('nobody@example.com') as never)).json()

    // No field that differs, so the endpoint cannot enumerate accounts.
    expect(known).toEqual(unknown)
    expect(known.ok).toBe(true)
  })
})
