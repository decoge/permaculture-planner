/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, test } from '@jest/globals'
import { NextRequest } from 'next/server'
import { createCache, cachePresets } from '@/lib/api/cache'

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost:3000${url}`, { headers }) as NextRequest
}

describe('user-scoped response cache', () => {
  beforeEach(() => {
    // createCache uses a module-global store, so isolate each case.
    const cache = createCache(cachePresets.user)
    cache.invalidate()
  })

  test('two different sessions never share a cache entry', async () => {
    const cache = createCache(cachePresets.user)

    cache.set(
      req('/api/auth/profile', { cookie: 'pp_session=alice-token' }),
      { email: 'alice@example.com' }
    )

    // Bob must miss, not receive Alice's cached profile.
    const bobHit = await cache.get(req('/api/auth/profile', { cookie: 'pp_session=bob-token' }))
    expect(bobHit).toBeNull()

    const aliceHit = await cache.get(req('/api/auth/profile', { cookie: 'pp_session=alice-token' }))
    expect(aliceHit).not.toBeNull()
  })

  test('the session cookie is matched among other cookies', async () => {
    const cache = createCache(cachePresets.user)

    cache.set(
      req('/api/auth/profile', { cookie: 'theme=dark; pp_session=alice-token; locale=en' }),
      { email: 'alice@example.com' }
    )

    const hit = await cache.get(
      req('/api/auth/profile', { cookie: 'theme=light; pp_session=alice-token; locale=en' })
    )
    expect(hit).not.toBeNull()
  })

  test('a request with no session does not match a sessioned entry', async () => {
    const cache = createCache(cachePresets.user)

    cache.set(req('/api/auth/profile', { cookie: 'pp_session=alice-token' }), { ok: true })

    expect(await cache.get(req('/api/auth/profile'))).toBeNull()
  })

  test('a bearer token does not substitute for the session cookie', async () => {
    const cache = createCache(cachePresets.user)

    // No cookie is present, so both callers land on the same 'anonymous' key --
    // which is exactly why keying must not depend on a header the app never
    // sends. With the cookie fix, real sessions are separated; two anonymous
    // callers are not, because they are genuinely indistinguishable here.
    cache.set(
      req('/api/auth/profile', { authorization: 'Bearer alice-token' }),
      { email: 'alice@example.com' }
    )

    const hit = await cache.get(req('/api/auth/profile'))
    expect(hit).not.toBeNull()

    // The important guarantee: a request carrying a real session never matches
    // an entry created for a different session.
    cache.set(req('/api/auth/profile', { cookie: 'pp_session=carol' }), { email: 'carol@example.com' })
    const dave = await cache.get(req('/api/auth/profile', { cookie: 'pp_session=dave' }))
    expect(dave).toBeNull()
  })
})