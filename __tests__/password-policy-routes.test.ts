/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const createUser = jest.fn<(input: { email: string; password: string }) => Promise<unknown>>()
const resetPasswordWithToken = jest.fn<(token: string, password: string) => Promise<boolean>>()

jest.mock('@/lib/db/users', () => ({
  createUser: (input: { email: string; password: string }) => createUser(input),
  resetPasswordWithToken: (token: string, password: string) => resetPasswordWithToken(token, password),
}))

function post(url: string, body: unknown) {
  return new Request(`http://localhost:3000${url}`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('password policy is enforced on the routes', () => {
  beforeEach(() => {
    createUser.mockReset()
    resetPasswordWithToken.mockReset()
    createUser.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      name: null,
      isAdmin: false,
      createdAt: null,
    })
    resetPasswordWithToken.mockResolvedValue(true)
  })

  test.each([
    ['too short', 'Ab1'],
    ['no uppercase', 'lowercase123'],
    ['no lowercase', 'UPPERCASE123'],
    ['no digit', 'NoDigitsHere'],
    ['empty', ''],
  ])('signup rejects a password that is %s', async (_label, password) => {
    const { POST } = await import('@/app/api/auth/signup/route')

    const response = await POST(post('/api/auth/signup', { email: 'a@b.com', password }) as never)

    expect(response.status).toBe(400)
    expect(createUser).not.toHaveBeenCalled()
  })

  test('signup accepts a password meeting the policy', async () => {
    const { POST } = await import('@/app/api/auth/signup/route')

    const response = await POST(
      post('/api/auth/signup', { email: 'a@b.com', password: 'Garden2026' }) as never
    )

    expect(response.status).toBe(200)
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({ password: 'Garden2026' })
    )
  })

  test('signup rejects an absurdly long password instead of hashing it', async () => {
    const { POST } = await import('@/app/api/auth/signup/route')

    const response = await POST(
      post('/api/auth/signup', { email: 'a@b.com', password: 'A1' + 'a'.repeat(5000) }) as never
    )

    expect(response.status).toBe(400)
    expect(createUser).not.toHaveBeenCalled()
  })

  test('reset-password applies the same policy', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')

    const response = await POST(
      post('/api/auth/reset-password', { token: 'tok', password: 'weak' }) as never
    )

    expect(response.status).toBe(400)
    expect(resetPasswordWithToken).not.toHaveBeenCalled()
  })

  test('reset-password accepts a compliant password', async () => {
    const { POST } = await import('@/app/api/auth/reset-password/route')

    const response = await POST(
      post('/api/auth/reset-password', { token: 'tok', password: 'Garden2026' }) as never
    )

    expect(response.status).toBe(200)
    expect(resetPasswordWithToken).toHaveBeenCalledWith('tok', 'Garden2026')
  })

  test('signup still validates the email before touching the password', async () => {
    const { POST } = await import('@/app/api/auth/signup/route')

    const response = await POST(post('/api/auth/signup', { email: 'nope', password: 'Garden2026' }) as never)

    expect(response.status).toBe(400)
    expect(createUser).not.toHaveBeenCalled()
  })
})