/**
 * @jest-environment node
 *
 * The mocked fetch returns real undici Response objects, which jsdom does not
 * provide; the client under test needs nothing browser-specific.
 */
import { afterEach, describe, expect, it, jest } from '@jest/globals'
import { api, ApiError } from '@/lib/api/http'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('api()', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns the parsed body on success', async () => {
    globalThis.fetch = jest.fn(async () => jsonResponse(200, { ok: true, value: 7 })) as typeof fetch

    await expect(api<{ ok: boolean; value: number }>('/api/x')).resolves.toEqual({ ok: true, value: 7 })
  })

  it('sets the JSON content type only when a body is sent', async () => {
    const fetchMock = jest.fn(async () => jsonResponse(200, {}))
    globalThis.fetch = fetchMock as typeof fetch

    await api('/api/get-only')
    await api('/api/with-body', { method: 'POST', body: JSON.stringify({ a: 1 }) })

    const [, getRequest] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const [, postRequest] = fetchMock.mock.calls[1] as unknown as [string, RequestInit]
    expect(getRequest.headers).toEqual({})
    expect(postRequest.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('throws ApiError with the server message and status', async () => {
    globalThis.fetch = jest.fn(async () =>
      jsonResponse(404, { error: 'Plan not found' })
    ) as typeof fetch

    const error = await api('/api/plans/nope').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
    expect((error as ApiError).message).toBe('Plan not found')
  })

  it('falls back to a generic message when the error body has no message', async () => {
    globalThis.fetch = jest.fn(async () => jsonResponse(500, { detail: 'internal' })) as typeof fetch

    const error = await api('/api/x').catch((e: unknown) => e)
    expect((error as ApiError).message).toBe('Request failed')
    expect((error as ApiError).status).toBe(500)
  })

  it('does not throw when the error response is not JSON', async () => {
    globalThis.fetch = jest.fn(
      async () => new Response('Bad Gateway', { status: 502 })
    ) as typeof fetch

    const error = await api('/api/x').catch((e: unknown) => e)
    expect((error as ApiError).status).toBe(502)
    expect((error as ApiError).message).toBe('Request failed')
  })

  it('propagates a network failure as a rejected promise', async () => {
    globalThis.fetch = jest.fn(async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch

    await expect(api('/api/x')).rejects.toThrow('Failed to fetch')
  })
})
