/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'

const requireUser = jest.fn<() => Promise<{ id: string } | null>>()

jest.mock('@/lib/auth/guard', () => ({
  requireUser: () => requireUser(),
}))

interface CompletionResult {
  choices: Array<{ message: { content: string } }>
}

const createCompletion = jest.fn<(args: unknown) => Promise<CompletionResult>>()

jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    chat = {
      completions: {
        create: (args: unknown) => createCompletion(args),
      },
    }
  },
}))

function post(body: unknown) {
  return new Request('http://localhost:3000/api/ai-assistant', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function put(body: unknown) {
  return new Request('http://localhost:3000/api/ai-assistant', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

describe('ai-assistant authentication', () => {
  const originalKey = process.env.OPENAI_API_KEY

  beforeEach(() => {
    requireUser.mockReset()
    createCompletion.mockReset()
    requireUser.mockResolvedValue(null)
    process.env.OPENAI_API_KEY = 'test-key'
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: 'ok' } }],
    })
  })

  afterEach(() => {
    // The suite deletes this key to exercise the 503 path; restore it so the
    // change cannot leak into later tests sharing the process.
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  })

  test('POST rejects an anonymous caller without calling the model', async () => {
    const { POST } = await import('@/app/api/ai-assistant/route')

    const response = await POST(post({ messages: [{ role: 'user', content: 'hi' }] }) as never)

    expect(response.status).toBe(401)
    expect(createCompletion).not.toHaveBeenCalled()
  })

  test('PUT rejects an anonymous caller without calling the model', async () => {
    const { PUT } = await import('@/app/api/ai-assistant/route')

    const response = await PUT(
      put({ type: 'site-analysis', data: { location: 'x', zone: 6 } }) as never
    )

    expect(response.status).toBe(401)
    expect(createCompletion).not.toHaveBeenCalled()
  })

  test('POST allows a signed-in caller through', async () => {
    requireUser.mockResolvedValue({ id: 'user-1' })
    const { POST } = await import('@/app/api/ai-assistant/route')

    const response = await POST(post({ messages: [{ role: 'user', content: 'hi' }] }) as never)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ response: 'ok' })

    const arg = createCompletion.mock.calls[0][0] as { messages: Array<{ role: string }> }
    expect(arg.messages[0].role).toBe('system')
  })

  test('POST reports a missing API key to an authenticated caller', async () => {
    requireUser.mockResolvedValue({ id: 'user-1' })
    delete process.env.OPENAI_API_KEY
    const { POST } = await import('@/app/api/ai-assistant/route')

    const response = await POST(post({ messages: [] }) as never)

    expect(response.status).toBe(503)
    expect(createCompletion).not.toHaveBeenCalled()
  })
})