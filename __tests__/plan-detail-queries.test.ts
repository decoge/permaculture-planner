/**
 * @jest-environment node
 *
 * getPlanDetail is imported dynamically after jest.doMock registers the pool
 * mock. '@/lib/db/ids' is mocked because the real module imports `uuid`, which
 * is ESM-only and cannot be required under Jest's CommonJS runtime.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

/** Every SQL string the code under test has issued, in order. */
let issued: string[]

/**
 * Highest number of queries that were ever in flight at the same moment.
 *
 * This is what distinguishes a sequential `await query(...)` chain from a
 * `Promise.all`: both issue the same statements in the same order, so counting
 * calls proves nothing.
 */
let maxInFlight: number
let inFlight: number

/** Rows to return, keyed by a distinctive fragment of the SQL. */
let responses: Array<{ match: string; rows: unknown[]; row?: unknown }>

function rowsFor(sql: string) {
  const hit = responses.find((r) => sql.includes(r.match))
  return hit ? hit.rows : []
}

function rowFor(sql: string) {
  const hit = responses.find((r) => sql.includes(r.match))
  return hit && hit.row !== undefined ? hit.row : null
}

async function loadGardens() {
  jest.resetModules()
  // Resolve only after a macrotask, so overlapping requests overlap in time
  // and an awaited chain can never have two in flight at once.
  const respond = async <T,>(value: T): Promise<T> => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)
    await new Promise((resolve) => setTimeout(resolve, 0))
    inFlight -= 1
    return value
  }
  jest.doMock('@/lib/db/pool', () => ({
    query: (sql: string) => {
      issued.push(sql)
      return respond(rowsFor(sql))
    },
    queryOne: (sql: string) => {
      issued.push(sql)
      // Mirror the real helper: an array in, a single row or null out.
      return respond(rowFor(sql))
    },
    withTransaction: jest.fn(),
  }))
  jest.doMock('@/lib/db/ids', () => ({
    asUuid: () => 'uuid',
    clampHeight: () => 12,
    currentSeason: () => 'spring',
    positiveFeet: (v: number) => v,
    surfaceOrSoil: () => 'soil',
    waterOrSpigot: () => 'spigot',
  }))
  return import('@/lib/db/gardens')
}

const PLAN = {
  id: 'plan-1',
  site_id: 'site-1',
  name: 'Plan',
  version: 1,
  status: 'draft',
  scene_json: null,
  meta: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  user_id: 'user-1',
  site_name: 'Site',
  constraints_json: {},
  lat: null,
  lng: null,
  country_code: 'US',
  usda_zone: '8b',
  last_frost: null,
  first_frost: null,
  surface_type: 'soil',
  slope_pct: null,
  shade_notes: null,
  water_source: 'spigot',
}

const OWNED = 'FROM plans p'
const BEDS = 'FROM beds WHERE plan_id'
const PLANTINGS = 'FROM plantings WHERE bed_id'
const MATERIALS = 'FROM materials_estimates'
const HARVESTS = 'FROM harvests h'
const TASKS = 'recurring_pattern'
const JOURNAL = 'FROM journal_entries'

beforeEach(() => {
  issued = []
  responses = []
  maxInFlight = 0
  inFlight = 0
})

describe('getPlanDetail', () => {
  test('runs the five detail queries concurrently rather than one after another', async () => {
    const gardens = await loadGardens()
    responses.push({ match: OWNED, rows: [PLAN], row: PLAN })
    responses.push({ match: BEDS, rows: [{ id: 'b1', order_index: 0 }] })
    responses.push({ match: PLANTINGS, rows: [] })

    const result = await gardens.getPlanDetail('user-1', 'plan-1')

    expect(result?.id).toBe('plan-1')
    expect(issued).toHaveLength(7)
    // Ownership and beds must be sequential (the plantings query needs the bed
    // ids), but the five that follow are all outstanding at once. Before the
    // Promise.all this peaked at 1.
    expect(maxInFlight).toBeGreaterThan(1)
  })

  test('does not query plantings at all when the plan has no beds', async () => {
    const gardens = await loadGardens()
    responses.push({ match: OWNED, rows: [PLAN], row: PLAN })
    responses.push({ match: BEDS, rows: [] })

    const result = await gardens.getPlanDetail('user-1', 'plan-1')

    expect(issued.some((sql) => sql.includes(PLANTINGS))).toBe(false)
    expect(result?.beds).toEqual([])
  })

  test('gives each bed exactly the plantings that belong to it', async () => {
    const gardens = await loadGardens()
    responses.push({ match: OWNED, rows: [PLAN], row: PLAN })
    responses.push({
      match: BEDS,
      rows: [
        { id: 'b1', order_index: 0 },
        { id: 'b2', order_index: 1 },
        { id: 'b3', order_index: 2 },
      ],
    })
    // Deliberately not in bed order: grouping must key off bed_id, not position.
    responses.push({
      match: PLANTINGS,
      rows: [
        { id: 'p1', bed_id: 'b2' },
        { id: 'p2', bed_id: 'b1' },
        { id: 'p3', bed_id: 'b2' },
      ],
    })

    const result = await gardens.getPlanDetail('user-1', 'plan-1')
    const beds = result!.beds as Array<{ id: string; plantings: Array<{ id: string }> }>

    expect(beds.map((bed) => bed.id)).toEqual(['b1', 'b2', 'b3'])
    expect(beds[0].plantings.map((p) => p.id)).toEqual(['p2'])
    expect(beds[1].plantings.map((p) => p.id)).toEqual(['p1', 'p3'])
    // A bed with no plantings gets an empty array, never undefined.
    expect(beds[2].plantings).toEqual([])
  })

  test('returns null and stops querying when the plan is not owned', async () => {
    const gardens = await loadGardens()
    responses.push({ match: OWNED, rows: [], row: null })

    expect(await gardens.getPlanDetail('user-1', 'missing')).toBeNull()
    expect(issued).toHaveLength(1)
  })
})
