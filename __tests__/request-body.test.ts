/**
 * @jest-environment node
 *
 * Route handlers stream request bodies with no default limit (the
 * `serverActions.bodySizeLimit` in next.config.js does not apply to them), so
 * every route used to buffer whatever it was sent. Malformed JSON also threw a
 * SyntaxError that routeError() reported as a 500.
 */
import { describe, expect, jest, test } from '@jest/globals'
import { asRecord, readJsonBody } from '@/lib/api/request-body'

const URL_UNDER_TEST = 'http://localhost:3000/api/whatever'

function bodyOf(value: string, headers: Record<string, string> = {}) {
  return new Request(URL_UNDER_TEST, { method: 'POST', body: value, headers })
}

describe('readJsonBody', () => {
  test('parses a normal JSON body', async () => {
    const result = await readJsonBody(bodyOf('{"name":"Bed"}'))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body).toEqual({ name: 'Bed' })
  })

  test('an empty body is an empty object, not an error', async () => {
    const result = await readJsonBody(bodyOf(''))

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.body).toEqual({})
  })

  test('malformed JSON is a 400, not a 500', async () => {
    const result = await readJsonBody(bodyOf('{"half":'))

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(400)
      await expect(result.response.json()).resolves.toMatchObject({ error: expect.stringMatching(/valid JSON/) })
    }
  })

  test('a declared oversize body is refused before it is read', async () => {
    const request = bodyOf('{"a":1}', { 'content-length': String(10 * 1024 * 1024) })
    const result = await readJsonBody(request, 1024)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(413)
      await expect(result.response.json()).resolves.toMatchObject({ error: expect.stringMatching(/larger than/) })
    }
  })

  test('an undeclared oversize body is refused after the read', async () => {
    // A chunked body has no content-length, so only the read can catch it.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('x'.repeat(4096)))
        controller.close()
      },
    })
    const request = new Request(URL_UNDER_TEST, {
      method: 'POST',
      body: stream,
      // @ts-expect-error -- duplex is required for a streaming request body in Node
      duplex: 'half',
    })

    const result = await readJsonBody(request, 1024)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.response.status).toBe(413)
  })
})

describe('asRecord', () => {
  test('keeps a plain object and folds everything else to undefined', () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 })
    expect(asRecord([1, 2])).toBeUndefined()
    expect(asRecord('nope')).toBeUndefined()
    expect(asRecord(42)).toBeUndefined()
    expect(asRecord(null)).toBeUndefined()
    expect(asRecord(undefined)).toBeUndefined()
  })
})
