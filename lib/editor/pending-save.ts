/**
 * Debounced save with an explicit flush.
 *
 * A debounce that only knows how to cancel loses whatever was scheduled when
 * the component unmounts — the editor navigates away inside the 2s window and
 * the bed the user just moved is never sent. The sender here is called either
 * by the timer or by `flush()` from an unmount handler, so nothing is dropped
 * silently; `cancel()` exists for the case where a later path (a manual save)
 * has already written the same payload.
 */
export interface PendingSave<T> {
  /** Replace the pending payload and restart the timer. */
  schedule(payload: T): void
  /** Send the pending payload now, if there is one. */
  flush(): void
  /** Drop the pending payload without sending it. */
  cancel(): void
  isPending(): boolean
}

export function createPendingSave<T>(options: {
  send: (payload: T) => Promise<unknown> | unknown
  onError?: (error: unknown) => void
  delayMs?: number
}): PendingSave<T> {
  const delayMs = options.delayMs ?? 2000
  let timer: ReturnType<typeof setTimeout> | null = null
  let payload: T | null = null

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  const sendNow = () => {
    clearTimer()
    if (payload === null) return
    const sending = payload
    // Cleared before the send so a re-entrant flush (unmount during a manual
    // save) cannot post the same payload twice.
    payload = null

    try {
      const result = options.send(sending)
      if (result && typeof (result as Promise<unknown>).catch === 'function') {
        void (result as Promise<unknown>).catch((error) => options.onError?.(error))
      }
    } catch (error) {
      options.onError?.(error)
    }
  }

  return {
    schedule(next) {
      payload = next
      clearTimer()
      timer = setTimeout(sendNow, delayMs)
    },
    flush: sendNow,
    cancel() {
      clearTimer()
      payload = null
    },
    isPending: () => payload !== null,
  }
}
