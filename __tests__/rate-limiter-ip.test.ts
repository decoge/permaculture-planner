/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals'
import { NextRequest } from 'next/server'
import { clientIp, createRateLimiter, rateLimitPresets } from '@/lib/api/rate-limiter'

function req(headers: Record<string, string> = {}, url = '/api/plans') {
  return new NextRequest(`http://localhost:3000${url}`, { headers })
}

describe('clientIp', () => {
  test('reads the rightmost x-forwarded-for entry, not the client-controlled first', () => {
    // A caller can put whatever they like first. Proxies append the address they
    // actually saw to the end, so the last entry is the only trustworthy one.
    const spoofed = req({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' })
    const real = req({ 'x-forwarded-for': '9.9.9.9' })

    expect(clientIp(spoofed)).toBe('9.9.9.9')
    // The whole point: a rotated first entry does not create a new bucket.
    expect(clientIp(spoofed)).toBe(clientIp(real))
  })

  test('cannot be rotated by varying the spoofed prefix', () => {
    const first = clientIp(req({ 'x-forwarded-for': '1.1.1.1, 5.5.5.5' }))
    const second = clientIp(req({ 'x-forwarded-for': '2.2.2.2, 5.5.5.5' }))
    expect(first).toBe(second)
  })

  test('falls back to x-real-ip when x-forwarded-for is absent', () => {
    expect(clientIp(req({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8')
  })

  test('prefers x-forwarded-for over x-real-ip when both are present', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2', 'x-real-ip': '3.3.3.3' }))).toBe(
      '2.2.2.2'
    )
  })

  test('returns unknown when no proxy header is present', () => {
    expect(clientIp(req())).toBe('unknown')
  })

  test('ignores an empty forwarded header rather than keying on empty string', () => {
    // An empty value would otherwise become a single shared bucket for every
    // caller that sends the header with no IP.
    expect(clientIp(req({ 'x-forwarded-for': '' }))).toBe('unknown')
    expect(clientIp(req({ 'x-forwarded-for': '   ' }))).toBe('unknown')
  })

  test('caps the length so a header cannot be an unbounded map key', () => {
    const huge = 'a'.repeat(100_000)
    const ip = clientIp(req({ 'x-forwarded-for': huge }))
    expect(ip.length).toBeLessThanOrEqual(64)
  })
})

describe('rate limiting cannot be bypassed by rotating a spoofed header', () => {
  test('a client sending a fresh first entry each time still hits the limit', async () => {
    const limiter = createRateLimiter('test-spoof', rateLimitPresets.auth)

    let limited = false
    for (let attempt = 0; attempt < 10; attempt += 1) {
      // Every request claims a different source IP before the real one.
      const request = req({ 'x-forwarded-for': `10.0.0.${attempt}, 203.0.113.7` })
      const response = await limiter.check(request)
      if (response) {
        limited = true
        expect(response.status).toBe(429)
        break
      }
    }

    expect(limited).toBe(true)
    limiter.destroy()
  })

  test('different real clients do not share a bucket', async () => {
    const limiter = createRateLimiter('test-distinct', rateLimitPresets.auth)

    // Each of these is a genuinely different last entry.
    const responses = []
    for (const ip of ['203.0.113.1', '203.0.113.2', '203.0.113.3']) {
      responses.push(await limiter.check(req({ 'x-forwarded-for': ip })))
    }

    expect(responses.every((response) => response === null)).toBe(true)
    limiter.destroy()
  })
})

describe('the cleanup timer does not hold the process open', () => {
  test('the limiter can be destroyed and stops its interval', () => {
    const limiter = createRateLimiter('test-destroy', rateLimitPresets.api)
    // Would throw or leave the handle dangling if destroy() did not clear it.
    expect(() => limiter.destroy()).not.toThrow()
    // A second destroy is a no-op, not a crash.
    expect(() => limiter.destroy()).not.toThrow()
  })
})
