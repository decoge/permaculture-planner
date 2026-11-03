/**
 * @jest-environment node
 *
 * A debounced autosave can fire while the previous PUT is still in flight. The
 * adapter used to answer "Save already in progress" and drop that snapshot, so
 * the newest edits stayed only in memory while the status bar said "All changes
 * saved". Saves now queue behind each other.
 */
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'

const api = jest.fn<(url: string, init?: unknown) => Promise<unknown>>()

jest.mock('@/lib/api/http', () => ({
  api: (...args: unknown[]) => api(...(args as [string, unknown?])),
  ApiError: class ApiError extends Error {},
}))

type AdapterModule = typeof import('@/lib/persistence/postgres-adapter')
let PostgresPersistence: AdapterModule['PostgresPersistence']

beforeAll(async () => {
  // Dynamic import after jest.mock, per the repo's documented trap.
  PostgresPersistence = (await import('@/lib/persistence/postgres-adapter')).PostgresPersistence
})

function bed(id: string) {
  return {
    id,
    name: id,
    points: [
      { x: 0, y: 0 },
      { x: 48, y: 0 },
      { x: 48, y: 48 },
      { x: 0, y: 48 },
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants: [],
  }
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('postgres adapter save queue', () => {
  beforeEach(() => {
    api.mockReset()
  })

  test('a save requested mid-flight is queued, not dropped', async () => {
    let releaseFirst: () => void = () => {}
    const firstInFlight = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    api.mockImplementationOnce(() => firstInFlight.then(() => ({})))
    api.mockResolvedValue({})

    const adapter = new PostgresPersistence('plan-1')

    const first = adapter.save([bed('bed-a')])
    const second = adapter.save([bed('bed-b')])

    await tick()
    // Only the first request may be on the wire; the second waits its turn.
    expect(api).toHaveBeenCalledTimes(1)

    releaseFirst()
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(firstResult).toEqual({ success: true, planId: 'plan-1' })
    expect(secondResult).toEqual({ success: true, planId: 'plan-1' })
    expect(api).toHaveBeenCalledTimes(2)

    const secondBody = JSON.parse((api.mock.calls[1][1] as { body: string }).body)
    expect(secondBody.beds.map((b: { id: string }) => b.id)).toEqual(['bed-b'])
  })

  test('a failed save does not wedge the next one', async () => {
    api.mockRejectedValueOnce(new Error('network down'))
    api.mockResolvedValue({})

    const adapter = new PostgresPersistence('plan-1')

    const failed = await adapter.save([bed('bed-a')])
    expect(failed.success).toBe(false)

    const succeeded = await adapter.save([bed('bed-b')])
    expect(succeeded).toEqual({ success: true, planId: 'plan-1' })
    expect(api).toHaveBeenCalledTimes(2)
  })
})

describe('postgres adapter flushPending', () => {
  beforeEach(() => {
    api.mockReset()
  })

  test('sends the payload waiting in the autosave window, once', async () => {
    jest.useFakeTimers()
    api.mockResolvedValue({})
    const adapter = new PostgresPersistence('plan-1')

    adapter.autoSave([bed('pending-bed')])
    // The debounce has not fired yet; unmounting now used to discard the edit.
    expect(api).not.toHaveBeenCalled()

    adapter.flushPending()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(api).toHaveBeenCalledTimes(1)
    const body = JSON.parse((api.mock.calls[0][1] as { body: string }).body)
    expect(body.beds.map((b: { id: string }) => b.id)).toEqual(['pending-bed'])

    // The cleared timer must not fire a second copy.
    await jest.runOnlyPendingTimersAsync()
    expect(api).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })
})
