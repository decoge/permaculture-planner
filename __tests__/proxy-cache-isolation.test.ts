/**
 * @jest-environment node
 *
 * The response cache in proxy.ts is keyed two ways: by URL for anonymous
 * callers, and by session cookie for signed-in ones. Picking the wrong store
 * for an authenticated GET lets one account's /api/dashboard body be replayed
 * to the next account that asks for the same URL.
 *
 * Nothing in the app calls cache.set today, so the leak cannot fire in
 * production yet — these tests seed the store directly to pin which key the
 * proxy chooses.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

jest.mock('@/lib/auth/token', () => ({
  SESSION_COOKIE: 'pp_session',
  verifySessionToken: jest.fn(async (token: string) =>
    token.startsWith('valid-') ? { sub: token, isAdmin: false } : null
  ),
}))

import { createCache, cachePresets } from '@/lib/api/cache'
import { SESSION_COOKIE } from '@/lib/auth/token'
import { proxy } from '@/proxy'

/** Just enough NextRequest for the proxy's read paths. */
function fakeRequest(url: string, token?: string) {
  const headers = new Headers({ host: 'localhost:3000' })
  if (token) headers.set('cookie', `${SESSION_COOKIE}=${token}`)
  return {
    url,
    nextUrl: new URL(url),
    method: 'GET',
    headers,
    cookies: {
      get: (name: string) =>
        name === SESSION_COOKIE && token ? { name, value: token } : undefined,
    },
  } as never
}

const URL_UNDER_TEST = 'http://localhost:3000/api/dashboard'

describe('proxy response cache keying', () => {
  beforeEach(() => {
    // The cache store is module-global, so each case starts from an empty one.
    createCache(cachePresets.medium).invalidate()
  })

  test('a signed-in caller never receives a body cached under the bare URL', async () => {
    // Seed exactly what a URL-keyed entry would hold: user A's dashboard.
    createCache(cachePresets.medium).set(fakeRequest(URL_UNDER_TEST), {
      user: { id: 'user-a', email: 'a@example.com' },
      plans: [{ id: 'plan-a', name: 'A only' }],
    } as never)

    const response = await proxy(fakeRequest(URL_UNDER_TEST, 'valid-user-b'))

    expect(response.headers.get('x-cache')).toBeNull()
    expect(await response.text()).not.toContain('user-a')
  })

  test('an anonymous caller still gets the URL-keyed entry', async () => {
    createCache(cachePresets.medium).set(fakeRequest(URL_UNDER_TEST), {
      plans: [],
    } as never)

    const response = await proxy(fakeRequest(URL_UNDER_TEST))

    expect(response.headers.get('x-cache')).toBe('HIT')
  })

  test('adds the security headers without the deprecated X-XSS-Protection', async () => {
    const response = await proxy(fakeRequest('http://localhost:3000/dashboard', 'valid-user-a'))

    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('x-frame-options')).toBe('DENY')
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    // Deprecated, ignored by current browsers, and abused as a script-disabling
    // vector in the ones that still read it.
    expect(response.headers.get('x-xss-protection')).toBeNull()
  })
})
