/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const createUser = jest.fn<(input: { email: string; password: string }) => Promise<unknown>>()
const createPasswordReset = jest.fn<(email: string) => Promise<string | null>>()
const resetPasswordWithToken = jest.fn<(token: string, password: string) => Promise<boolean>>()

jest.mock('@/lib/db/users', () => ({
  createUser: (input: { email: string; password: string }) => createUser(input),
  createPasswordReset: (email: string) => createPasswordReset(email),
  resetPasswordWithToken: (token: string, password: string) => resetPasswordWithToken(token, password),
}))

function post(url: string, body: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('auth routes reject addresses that only look like an email', () => {
  beforeEach(() => {
    createUser.mockReset()
    createPasswordReset.mockReset()
    resetPasswordWithToken.mockReset()
    createUser.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: null,
      isAdmin: false,
      tokenVersion: 0,
      createdAt: null,
    })
    createPasswordReset.mockResolvedValue(null)
    resetPasswordWithToken.mockResolvedValue(true)
  })

  // The old check was `email.includes('@') && email.includes('.')`, which all of
  // these satisfy. Storing a near-copy of another account's address is the part
  // that matters: it is how one user ends up receiving another's reset link.
  const LOOKS_LIKE_AN_EMAIL = [
    '@example.com',
    'a b@c.com',
    'a@b..com',
    'a@.',
    '.@.',
    'no-at-sign',
    'user@',
    '@',
  ]

  test.each(LOOKS_LIKE_AN_EMAIL)('signup rejects %j', async (email) => {
    const { POST } = await import('@/app/api/auth/signup/route')

    const response = await POST(
      post('/api/auth/signup', { email, password: 'Garden2026' }) as never
    )

    expect(response.status).toBe(400)
    expect(createUser).not.toHaveBeenCalled()
  })

  test.each(LOOKS_LIKE_AN_EMAIL)('forgot-password rejects %j', async (email) => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')

    const response = await POST(post('/api/auth/forgot-password', { email }) as never)

    expect(response.status).toBe(400)
    expect(createPasswordReset).not.toHaveBeenCalled()
  })

  test.each(['a@b.co', 'user+tag@domain.co.uk', 'first.last@example.com'])(
    'signup still accepts the real address %s',
    async (email) => {
      const { POST } = await import('@/app/api/auth/signup/route')

      const response = await POST(
        post('/api/auth/signup', { email, password: 'Garden2026' }) as never
      )

      expect(response.status).toBe(200)
      expect(createUser).toHaveBeenCalled()
    }
  )

  test('signup trims surrounding whitespace before validating', async () => {
    const { POST } = await import('@/app/api/auth/signup/route')

    const response = await POST(
      post('/api/auth/signup', { email: '  user@example.com  ', password: 'Garden2026' }) as never
    )

    expect(response.status).toBe(200)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' })
    )
  })

  test('a missing email is a 400, not a database lookup', async () => {
    const { POST } = await import('@/app/api/auth/signup/route')

    for (const email of [undefined, null, 123, {}]) {
      createUser.mockClear()
      const response = await POST(
        post('/api/auth/signup', { email, password: 'Garden2026' }) as never
      )
      expect(response.status).toBe(400)
      expect(createUser).not.toHaveBeenCalled()
    }
  })
})
