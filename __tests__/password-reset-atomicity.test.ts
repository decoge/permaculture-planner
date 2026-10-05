/**
 * @jest-environment node
 *
 * lib/db/users is imported dynamically after jest.mock registers the pool mock,
 * so the mock is in place before it binds its copy of '@/lib/db/pool'.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const query = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>()
const queryOne = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown>>()
const clientQuery = jest.fn<
  (sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: unknown[] }>
>()

jest.mock('@/lib/db/pool', () => ({
  query: (sql: string, params?: unknown[]) => query(sql, params),
  queryOne: (sql: string, params?: unknown[]) => queryOne(sql, params),
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) =>
    fn({ query: (sql: string, params?: unknown[]) => clientQuery(sql, params) }),
}))

jest.mock('@/lib/auth/session', () => ({
  writeSession: async () => {},
  clearSession: async () => {},
}))

// Password hashing is slow and irrelevant here.
jest.mock('@/lib/auth/password', () => ({
  hashPassword: async (value: string) => `hashed:${value}`,
  verifyPassword: async () => true,
}))

let users: typeof import('@/lib/db/users')

beforeEach(async () => {
  query.mockReset()
  queryOne.mockReset()
  clientQuery.mockReset()
  clientQuery.mockResolvedValue({ rowCount: 0, rows: [] })
  users = await import('@/lib/db/users')
})

function statements() {
  return clientQuery.mock.calls.map((call) => call[0] as string)
}

describe('resetPasswordWithToken claims the token atomically', () => {
  test('marks the token used in the same statement that validates it', async () => {
    clientQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 't1', user_id: 'u1' }] })

    const result = await users.resetPasswordWithToken('tok', 'Garden2026')

    expect(result).toBe(true)

    // The claim is a single UPDATE ... WHERE used_at IS NULL RETURNING, not a
    // SELECT followed by an UPDATE. Two concurrent requests can no longer both
    // pass the check and both change the password.
    const claim = statements()[0]
    expect(claim).toContain('UPDATE password_reset_tokens')
    expect(claim).toContain('used_at IS NULL')
    expect(claim).toContain('RETURNING')
    expect(claim).not.toContain('SELECT')
  })

  test('changes the password and invalidates every existing session', async () => {
    clientQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 't1', user_id: 'u1' }] })

    await users.resetPasswordWithToken('tok', 'Garden2026')

    const update = statements().find((sql) => sql.includes('UPDATE users'))
    expect(update).toBeDefined()
    // A reset must kill a stolen cookie, not just change the secret.
    expect(update).toContain('token_version = token_version + 1')

    const params = clientQuery.mock.calls.find((sql) => sql[0].includes('UPDATE users'))![1] as unknown[]
    expect(params[0]).toBe('u1')
    expect(params[1]).toBe('hashed:Garden2026')
  })

  test('reports failure and writes nothing when the token is already used or expired', async () => {
    // rowCount 0 is what Postgres returns when the WHERE matched no row.
    clientQuery.mockResolvedValue({ rowCount: 0, rows: [] })

    const result = await users.resetPasswordWithToken('tok', 'Garden2026')

    expect(result).toBe(false)
    // Crucially, no password change: the token was not ours to spend.
    expect(statements().some((sql) => sql.includes('UPDATE users'))).toBe(false)
  })

  test('stores only a hash of the token, never the token itself', async () => {
    clientQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: 't1', user_id: 'u1' }] })

    await users.resetPasswordWithToken('super-secret-token', 'Garden2026')

    const params = clientQuery.mock.calls[0][1] as unknown[]
    // sha256 hex, so the value passed to the database is not the token.
    expect(params[0]).not.toBe('super-secret-token')
    expect(params[0]).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('createPasswordReset supersedes old links', () => {
  test('deletes every existing token for the user, not just unused ones', async () => {
    queryOne.mockResolvedValue({ id: 'u1' })

    await users.createPasswordReset('user@example.com')

    const del = query.mock.calls.find((sql) => sql[0].includes('DELETE FROM password_reset_tokens'))
    expect(del).toBeDefined()
    // The old query filtered to `used_at IS NULL`, so used rows accumulated for
    // the lifetime of the account.
    expect(del![0]).not.toContain('used_at IS NULL')
    expect(del![1]).toEqual(['u1'])
  })

  test('creates a fresh high-entropy token and stores its hash', async () => {
    queryOne.mockResolvedValue({ id: 'u1' })

    const token = await users.createPasswordReset('user@example.com')

    expect(token).toBeTruthy()
    // 32 random bytes, base64url.
    expect(token!).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const insert = query.mock.calls.find((sql) => sql[0].includes('INSERT INTO password_reset_tokens'))
    const params = insert![1] as unknown[]
    expect(params[1]).toMatch(/^[0-9a-f]{64}$/)
    expect(params[1]).not.toBe(token)
  })

  test('normalises the email before looking the user up', async () => {
    queryOne.mockResolvedValue({ id: 'u1' })

    await users.createPasswordReset('  User@Example.COM  ')

    expect(queryOne.mock.calls[0][1]).toEqual(['user@example.com'])
  })

  test('returns null for an unknown address without creating a token', async () => {
    queryOne.mockResolvedValue(null)

    expect(await users.createPasswordReset('nobody@example.com')).toBeNull()
    expect(query).not.toHaveBeenCalled()
  })
})
