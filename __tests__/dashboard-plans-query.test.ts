/**
 * @jest-environment node
 *
 * lib/db/gardens is imported dynamically *after* jest.mock registers the pool
 * mock: a static import binds the real '@/lib/db/pool' first, so the mock would
 * sit unused.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const query = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>()
const queryOne = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown>>()

jest.mock('@/lib/db/pool', () => ({
  query: (sql: string, params?: unknown[]) => query(sql, params),
  queryOne: (sql: string, params?: unknown[]) => queryOne(sql, params),
  withTransaction: jest.fn(),
}))

// lib/db/ids pulls in `uuid`, which is ESM-only and cannot be required under
// Jest's CommonJS runtime. listDashboardPlans does not use any of it, so a stub
// keeps the suite about the queries it actually issues.
jest.mock('@/lib/db/ids', () => ({
  asUuid: () => 'uuid',
  clampHeight: () => 12,
  currentSeason: () => 'spring',
  familyOrOther: () => 'Other',
  positiveFeet: (value: number) => value,
  surfaceOrSoil: () => 'soil',
  waterOrSpigot: () => 'spigot',
}))

type GardensModule = typeof import('@/lib/db/gardens')
let listDashboardPlans: GardensModule['listDashboardPlans']

beforeEach(async () => {
  query.mockReset()
  queryOne.mockReset()
  const gardens = await import('@/lib/db/gardens')
  listDashboardPlans = gardens.listDashboardPlans
})

/** Route each query to a fixture by a distinctive fragment of its SQL. */
function respondWith(fixtures: Record<string, unknown[]>) {
  query.mockImplementation(async (sql: string) => {
    for (const [fragment, rows] of Object.entries(fixtures)) {
      if (sql.includes(fragment)) return rows
    }
    throw new Error(`unexpected query: ${sql}`)
  })
}

const PLANS = [
  { id: 'p1', site_id: 's1', name: 'Plan one' },
  { id: 'p2', site_id: 's2', name: 'Plan two' },
  { id: 'p3', site_id: 's3', name: 'Plan three' },
]

describe('listDashboardPlans', () => {
  test('uses a fixed number of queries regardless of how many plans a user owns', async () => {
    respondWith({
      'FROM plans p': PLANS,
      'FROM sites WHERE id = ANY': [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
      'FROM beds WHERE plan_id = ANY': [],
      'FROM materials_estimates': [],
      'GROUP BY b.plan_id': [],
    })

    await listDashboardPlans('user-1')

    // 1 for the plans, 1 per related table. Before the rewrite this was
    // 1 + 4 per plan, so a five-plan dashboard cost 21 round trips.
    expect(query).toHaveBeenCalledTimes(5)
    expect(queryOne).not.toHaveBeenCalled()
  })

  test('scales flat: three plans and one plan cost the same', async () => {
    respondWith({
      'FROM plans p': PLANS,
      'FROM sites WHERE id = ANY': [],
      'FROM beds WHERE plan_id = ANY': [],
      'FROM materials_estimates': [],
      'GROUP BY b.plan_id': [],
    })
    await listDashboardPlans('user-1')
    const withThree = query.mock.calls.length

    query.mockClear()
    respondWith({
      'FROM plans p': [PLANS[0]],
      'FROM sites WHERE id = ANY': [],
      'FROM beds WHERE plan_id = ANY': [],
      'FROM materials_estimates': [],
      'GROUP BY b.plan_id': [],
    })
    await listDashboardPlans('user-1')

    expect(query.mock.calls.length).toBe(withThree)
  })

  test('attaches each bed to its own plan and computes per-plan stats', async () => {
    respondWith({
      'FROM plans p': PLANS,
      'FROM sites WHERE id = ANY': [{ id: 's1', name: 'Site one' }],
      // Deliberately interleaved across plans, and pre-sorted as
      // "ORDER BY plan_id, order_index" would return them -- this function
      // relies on the database for ordering rather than re-sorting in JS.
      'FROM beds WHERE plan_id = ANY': [
        { id: 'b3', plan_id: 'p1', order_index: 0, length_ft: 10, width_ft: 2 },
        { id: 'b1', plan_id: 'p1', order_index: 1, length_ft: 8, width_ft: 4 },
        { id: 'b2', plan_id: 'p2', order_index: 0, length_ft: 4, width_ft: 2 },
      ],
      'FROM materials_estimates': [{ plan_id: 'p2', cost_estimate_cents: 5000 }],
      'GROUP BY b.plan_id': [{ plan_id: 'p1', plants: 7, varieties: 3 }],
    })

    const result = await listDashboardPlans('user-1')

    expect(result).toHaveLength(3)
    const [one, two, three] = result

    expect(one.beds.map((bed) => bed.id)).toEqual(['b3', 'b1'])
    expect(one.stats).toEqual({ plants: 7, varieties: 3, area: 52, beds: 2 })
    expect(one.site).toEqual({ id: 's1', name: 'Site one' })

    expect(two.beds.map((bed) => bed.id)).toEqual(['b2'])
    expect(two.stats.area).toBe(8)
    expect(two.materials_estimates).toEqual({ plan_id: 'p2', cost_estimate_cents: 5000 })

    // No beds, no site, no estimate: zeros and nulls, not a crash.
    expect(three.beds).toEqual([])
    expect(three.stats).toEqual({ plants: 0, varieties: 0, area: 0, beds: 0 })
    expect(three.site).toBeNull()
    expect(three.materials_estimates).toBeNull()
  })

  test('issues no follow-up queries when the user owns no plans', async () => {
    respondWith({ 'FROM plans p': [] })

    expect(await listDashboardPlans('user-1')).toEqual([])
    expect(query).toHaveBeenCalledTimes(1)
  })
})
