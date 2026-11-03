/**
 * @jest-environment node
 *
 * public/service-worker.js is not a module and no test touched it, yet in
 * production it sits in front of every request. The defect this guards: it
 * cached API responses keyed on the URL alone, so a failed request would replay
 * whichever account's /api/dashboard was last cached on that browser.
 *
 * The worker is executed in a VM with stubbed `self`, `caches` and `fetch`, so
 * the assertions are about what it really does rather than what it looks like.
 */
import fs from 'fs'
import path from 'path'
import vm from 'vm'
import { describe, expect, jest, test } from '@jest/globals'

const ORIGIN = 'https://app.test'
const WORKER_SOURCE = fs.readFileSync(
  path.join(process.cwd(), 'public', 'service-worker.js'),
  'utf8'
)

type Listener = (event: unknown) => void

interface Harness {
  listeners: Record<string, Listener[]>
  puts: string[]
  fetch: jest.Mock<(request: Request) => Promise<Response>>
}

function loadWorker(fetchImpl: (request: Request) => Promise<Response>): Harness {
  const listeners: Record<string, Listener[]> = {}
  const puts: string[] = []
  const openCaches: string[] = []

  const cache = {
    put: async (request: Request) => {
      puts.push(request.url)
    },
    addAll: async () => {},
  }

  const caches = {
    open: async (name: string) => {
      openCaches.push(name)
      return cache
    },
    keys: async () => openCaches,
    delete: async () => true,
    match: async () => undefined,
  }

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => {
      ;(listeners[type] ||= []).push(fn)
    },
    skipWaiting: () => {},
    clients: { claim: () => {}, openWindow: () => {} },
    registration: { showNotification: () => {} },
  }

  const fetchMock = jest.fn(fetchImpl) as unknown as Harness['fetch']

  const context = vm.createContext({
    self,
    caches,
    fetch: fetchMock,
    Response,
    Request,
    URL,
    console,
    JSON,
    Promise,
    setTimeout,
  })

  vm.runInContext(WORKER_SOURCE, context, { filename: 'service-worker.js' })

  return { listeners, puts, fetch: fetchMock }
}

/** Dispatch a fetch event and return whatever the worker responded with. */
async function dispatchFetch(
  harness: Harness,
  request: Request
): Promise<{ responded: boolean; response?: Response }> {
  let responded = false
  let response: Response | undefined
  const event = {
    request,
    respondWith: (value: Response | Promise<Response>) => {
      responded = true
      // The handler may hand over a promise; await it so assertions see the result.
      return Promise.resolve(value).then((resolved) => {
        response = resolved
      })
    },
  }

  for (const listener of harness.listeners.fetch ?? []) {
    listener(event)
  }
  // Let the respondWith promise settle.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return { responded, response }
}

describe('service worker caching', () => {
  test('never stores an API response', async () => {
    const harness = loadWorker(async () => new Response('{"plans":[]}', { status: 200 }))

    const { responded, response } = await dispatchFetch(
      harness,
      new Request(`${ORIGIN}/api/dashboard`, { method: 'GET' })
    )

    expect(responded).toBe(true)
    expect(response?.status).toBe(200)
    // The whole point: nothing keyed on that URL went into a cache.
    expect(harness.puts).toEqual([])
  })

  test('serves an offline error instead of a cached earlier response', async () => {
    const harness = loadWorker(async () => {
      throw new TypeError('Failed to fetch')
    })

    const { response } = await dispatchFetch(
      harness,
      new Request(`${ORIGIN}/api/dashboard`, { method: 'GET' })
    )

    expect(response?.status).toBe(503)
    await expect(response?.json()).resolves.toMatchObject({ error: 'Offline' })
  })

  test('still caches a static asset that loaded', async () => {
    const harness = loadWorker(async () => new Response('console.log(1)', { status: 200 }))

    await dispatchFetch(
      harness,
      new Request(`${ORIGIN}/_next/static/chunks/main.js`, { method: 'GET' })
    )

    expect(harness.puts).toEqual([`${ORIGIN}/_next/static/chunks/main.js`])
  })

  test('does not cache an asset that failed', async () => {
    const harness = loadWorker(async () => new Response('not found', { status: 404 }))

    await dispatchFetch(
      harness,
      new Request(`${ORIGIN}/_next/static/chunks/missing.js`, { method: 'GET' })
    )

    expect(harness.puts).toEqual([])
  })

  test('a non-GET request outside /api/ is left to the network', async () => {
    const harness = loadWorker(async () => new Response('ok', { status: 200 }))

    const { responded } = await dispatchFetch(
      harness,
      new Request(`${ORIGIN}/some-form`, { method: 'POST', body: 'x' })
    )

    expect(responded).toBe(false)
    expect(harness.fetch).not.toHaveBeenCalled()
  })
})

describe('service worker user-scoped pages', () => {
  test.each(['/plans/abc-123', '/editor/abc-123', '/dashboard', '/settings', '/admin/users'])(
    'does not cache %s, whose HTML contains one user\'s data',
    async (pathname) => {
      const harness = loadWorker(async () => new Response('<html>plan</html>', { status: 200 }))

      const { response } = await dispatchFetch(harness, new Request(`${ORIGIN}${pathname}`))

      expect(response?.status).toBe(200)
      expect(harness.puts).toEqual([])
    }
  )

  test('still caches a public page', async () => {
    const harness = loadWorker(async () => new Response('<html>pricing</html>', { status: 200 }))

    await dispatchFetch(harness, new Request(`${ORIGIN}/pricing`))

    expect(harness.puts).toEqual([`${ORIGIN}/pricing`])
  })

  test('shows the offline notice instead of a cached plan page', async () => {
    const harness = loadWorker(async () => {
      throw new TypeError('Failed to fetch')
    })

    const { response } = await dispatchFetch(harness, new Request(`${ORIGIN}/plans/abc-123`))

    expect(response?.status).toBe(200)
    expect(await response?.text()).toContain('Offline')
  })
})
