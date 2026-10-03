import { describe, expect, test } from '@jest/globals'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password hashing', () => {
  test('verifies a matching password and rejects a different one', async () => {
    const stored = await hashPassword('garden-bed-6')
    expect(stored.startsWith('scrypt$')).toBe(true)
    await expect(verifyPassword('garden-bed-6', stored)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false)
  })
})
