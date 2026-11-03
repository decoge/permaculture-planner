/**
 * @jest-environment node
 *
 * Wiring check for the bounded body read: the routes must answer 400 for a
 * malformed body and 413 for an oversize one instead of letting `request.json()`
 * throw and routeError() report a 500.
 */
import { describe, expect, jest, test } from '@jest/globals'

jest.mock('@/lib/auth/guard', () => ({
  requireUser: async () => ({ id: 'user-1', email: 'a@example.com', name: null, isAdmin: false }),
}))

const updateUserProfile = jest.fn(async (_id: string, name: string) => ({
  id: 'user-1',
  email: 'a@example.com',
  name,
  isAdmin: false,
  tokenVersion: 1,
  createdAt: null,
}))

jest.mock('@/lib/db/users', () => ({
  updateUserProfile: (id: string, name: string) => updateUserProfile(id, name),
}))

function patch(body: string, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/auth/profile', {
    method: 'PATCH',
    body,
    headers,
  })
}

describe('PATCH /api/auth/profile body handling', () => {
  test('malformed JSON answers 400 rather than 500', async () => {
    const { PATCH } = await import('@/app/api/auth/profile/route')

    const response = await PATCH(patch('{"name":'))

    expect(response.status).toBe(400)
    expect(updateUserProfile).not.toHaveBeenCalled()
  })

  test('an oversize body answers 413', async () => {
    const { PATCH } = await import('@/app/api/auth/profile/route')

    const response = await PATCH(
      patch('{"name":"x"}', { 'content-length': String(10 * 1024 * 1024) })
    )

    expect(response.status).toBe(413)
    expect(updateUserProfile).not.toHaveBeenCalled()
  })

  test('a valid body still updates the profile', async () => {
    const { PATCH } = await import('@/app/api/auth/profile/route')

    const response = await PATCH(patch(JSON.stringify({ name: 'Fern' })))

    expect(response.status).toBe(200)
    expect(updateUserProfile).toHaveBeenCalledWith('user-1', 'Fern')
  })
})
