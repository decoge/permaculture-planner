/**
 * A debounced save must not drop its payload when the component goes away:
 * navigating inside the debounce window is exactly when a user has just moved
 * a bed and is most likely to lose it.
 */
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals'
import { createPendingSave } from '@/lib/editor/pending-save'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('createPendingSave', () => {
  test('sends once after the delay, with the latest payload', () => {
    const send = jest.fn<(payload: string) => void>()
    const pending = createPendingSave<string>({ send, delayMs: 2000 })

    pending.schedule('first')
    pending.schedule('second')

    expect(send).not.toHaveBeenCalled()
    jest.advanceTimersByTime(2000)

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith('second')
    expect(pending.isPending()).toBe(false)
  })

  test('flush sends the pending payload immediately and clears the timer', () => {
    const send = jest.fn<(payload: string) => void>()
    const pending = createPendingSave<string>({ send, delayMs: 2000 })

    pending.schedule('unsaved')
    pending.flush()

    expect(send).toHaveBeenCalledWith('unsaved')
    // The debounce timer must not fire a second copy afterwards.
    jest.advanceTimersByTime(5000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  test('flush is a no-op when nothing is pending', () => {
    const send = jest.fn<(payload: string) => void>()
    const pending = createPendingSave<string>({ send, delayMs: 2000 })

    pending.flush()
    expect(send).not.toHaveBeenCalled()
  })

  test('cancel drops the payload without sending it', () => {
    const send = jest.fn<(payload: string) => void>()
    const pending = createPendingSave<string>({ send, delayMs: 2000 })

    pending.schedule('superseded by a manual save')
    pending.cancel()
    jest.advanceTimersByTime(5000)

    expect(send).not.toHaveBeenCalled()
    expect(pending.isPending()).toBe(false)
  })

  test('a rejected send reaches onError instead of becoming an unhandled rejection', async () => {
    const onError = jest.fn<(error: unknown) => void>()
    const failure = new Error('autosave failed')
    const pending = createPendingSave<string>({
      send: async () => {
        throw failure
      },
      onError,
      delayMs: 10,
    })

    pending.schedule('payload')
    jest.advanceTimersByTime(10)
    // Let the rejected promise settle.
    await Promise.resolve()
    await Promise.resolve()

    expect(onError).toHaveBeenCalledWith(failure)
  })
})
