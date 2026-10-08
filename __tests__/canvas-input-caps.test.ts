/**
 * @jest-environment node
 *
 * replaceBeds takes the canvas wholesale from the client on every autosave.
 * These tests pin the caps on untrusted input sizes so a caller cannot make
 * the server do unbounded work. The pg client is mocked; assertions are about
 * the parameters it is handed.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const clientQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: unknown[] }>>()

jest.mock('@/lib/db/pool', () => ({
  query: async () => [],
  queryOne: async () => null,
  withTransaction: async (fn: (client: unknown) => Promise<unknown>) =>
    fn({ query: (sql: string, params?: unknown[]) => clientQuery(sql, params) }),
}))

jest.mock('@/lib/db/ids', () => ({
  asUuid: (id?: string) => (id ? `uuid:${id}` : `uuid:gen-${Math.random()}`),
  clampHeight: () => 12,
  currentSeason: () => 'spring',
  positiveFeet: (value: number) => value,
  surfaceOrSoil: () => 'soil',
  waterOrSpigot: () => 'spigot',
}))

let updateGarden: typeof import('@/lib/db/gardens')['updateGarden']

const PLAN_ROW = {
  id: 'plan-1',
  site_id: 'site-1',
  name: 'Plan',
  version: 1,
  constraints_json: {},
}

beforeEach(async () => {
  clientQuery.mockReset()
  clientQuery.mockResolvedValue({ rowCount: 1, rows: [PLAN_ROW] })
  const gardens = await import('@/lib/db/gardens')
  updateGarden = gardens.updateGarden
})

function bedsInsertParams() {
  const call = clientQuery.mock.calls.find((sql) => (sql[0] as string).includes('INSERT INTO beds'))
  if (!call) throw new Error('no beds insert')
  return call[1] as unknown[]
}

describe('replaceBeds caps on client-supplied canvas data', () => {
  test('more than 500 beds are truncated, not stored', async () => {
    const beds = Array.from({ length: 700 }, (_, i) => ({ id: `bed-${i}`, name: `B${i}` }))
    await updateGarden('user-1', 'plan-1', beds)

    const names = bedsInsertParams()[2] as string[]
    expect(names).toHaveLength(500)
  })

  test('more than 1000 plants per bed are truncated', async () => {
    const plants = Array.from({ length: 1500 }, (_, i) => ({ id: `p-${i}`, plantId: 'tomato', x: 1, y: 1 }))
    await updateGarden('user-1', 'plan-1', [{ id: 'bed-a', name: 'A', plants }])

    // The plantings insert carries the flattened, capped list; its first
    // parameter is the ids array.
    const call = clientQuery.mock.calls.find((sql) => (sql[0] as string).includes('INSERT INTO plantings'))
    const ids = (call![1] as unknown[])[0] as unknown[]
    expect(ids).toHaveLength(1000)
  })

  test('polygon points beyond 2000 are dropped, and non-numeric points are filtered', async () => {
    const points = Array.from({ length: 3000 }, (_, i) => ({ x: i, y: i }))
    // One corrupted point in the middle.
    points[1500] = { x: NaN, y: 5 } as { x: number; y: number }

    await updateGarden('user-1', 'plan-1', [{ id: 'bed-a', name: 'A', points }])

    const notes = (bedsInsertParams()[7] as string[])[0]
    const parsed = JSON.parse(notes)
    // 3000 minus 1 bad point, capped to 2000.
    expect(parsed.points).toHaveLength(2000)
    for (const point of parsed.points) {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    }
  })

  test('bed names longer than 200 characters are truncated', async () => {
    await updateGarden('user-1', 'plan-1', [{ id: 'bed-a', name: 'x'.repeat(5000) }])

    const names = bedsInsertParams()[2] as string[]
    expect(names[0]).toHaveLength(200)
  })

  test('metadata larger than 64KB is dropped whole, smaller metadata kept', async () => {
    const big = { blob: 'x'.repeat(100_000) }
    const small = { zone: 2 }
    await updateGarden('user-1', 'plan-1', [
      { id: 'bed-a', name: 'A', metadata: big },
      { id: 'bed-b', name: 'B', metadata: small },
    ])

    const notes = bedsInsertParams()[7] as string[]
    const first = JSON.parse(notes[0])
    const second = JSON.parse(notes[1])
    expect(first.metadata).toBeUndefined()
    expect(second.metadata).toEqual(small)
  })

  test('non-array beds input deletes everything instead of throwing', async () => {
    const result = await updateGarden('user-1', 'plan-1', undefined as never)
    expect(result).toEqual({ planId: 'plan-1', siteId: 'site-1' })

    const sql = clientQuery.mock.calls.map((call) => call[0] as string).join('\n')
    expect(sql).toContain('DELETE FROM beds')
    expect(sql).not.toContain('INSERT INTO beds')
  })
})
