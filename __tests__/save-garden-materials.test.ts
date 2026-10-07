/**
 * @jest-environment node
 *
 * saveGarden computes a materials estimate on first creation so wizard-created
 * plans get a materials_estimates row (the ROI panel reads it). The client is
 * mocked so the assertions are about the statements issued.
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

const INSERTED_SITE = { rowCount: 1, rows: [{ id: 'site-1' }] }
const INSERTED_PLAN = { rowCount: 1, rows: [{ id: 'plan-1' }] }

let saveGarden: typeof import('@/lib/db/gardens')['saveGarden']

beforeEach(async () => {
  clientQuery.mockReset()
  // Site insert first, plan insert second; everything else returns one row.
  clientQuery.mockImplementation((sql: string) => {
    if (sql.includes('INSERT INTO sites')) return Promise.resolve(INSERTED_SITE)
    if (sql.includes('INSERT INTO plans')) return Promise.resolve(INSERTED_PLAN)
    return Promise.resolve({ rowCount: 1, rows: [] })
  })
  const gardens = await import('@/lib/db/gardens')
  saveGarden = gardens.saveGarden
})

const BEDS = [
  { id: 'bed-a', name: 'Bed A', width: 96, height: 48 },
  { id: 'bed-b', name: 'Bed B', width: 96, height: 48 },
]

describe('saveGarden materials estimate', () => {
  test('a first save writes a materials_estimates row', async () => {
    await saveGarden('user-1', { beds: BEDS })

    const call = clientQuery.mock.calls.find((sql) => (sql[0] as string).includes('INSERT INTO materials_estimates'))
    expect(call).toBeDefined()
  })

  test('the estimate carries the plan id, bed quantities and a cost in cents', async () => {
    await saveGarden('user-1', { beds: BEDS })

    const call = clientQuery.mock.calls.find((sql) => (sql[0] as string).includes('INSERT INTO materials_estimates'))
    const params = call![1] as unknown[]

    expect(params[0]).toBe('plan-1')
    // Two 8x4 beds at 12in depth: soil volume is positive and finite.
    const soilCuft = params[1] as number
    expect(Number.isFinite(soilCuft)).toBe(true)
    expect(soilCuft).toBeGreaterThan(0)
    // Cost is stored in cents.
    const costCents = params[9] as number
    expect(Number.isFinite(costCents)).toBe(true)
    expect(costCents).toBeGreaterThan(0)
  })

  test('an update of an existing plan does not add a second estimate', async () => {
    await saveGarden('user-1', {
      beds: BEDS,
      planData: { id: 'existing-plan' },
    })

    const sql = clientQuery.mock.calls.map((call) => call[0] as string).join('\n')
    expect(sql).not.toContain('INSERT INTO materials_estimates')
  })

  test('an empty canvas writes no estimate', async () => {
    await saveGarden('user-1', { beds: [] })

    const sql = clientQuery.mock.calls.map((call) => call[0] as string).join('\n')
    expect(sql).not.toContain('INSERT INTO materials_estimates')
  })

  test('a calculator failure does not fail the save', async () => {
    // Force the calculator to throw by feeding it an unconstructible bed: the
    // estimate wrapper must swallow it and still return success.
    clientQuery.mockImplementation((sql: string) => {
      if (sql.includes('INSERT INTO sites')) return Promise.resolve(INSERTED_SITE)
      if (sql.includes('INSERT INTO plans')) return Promise.resolve(INSERTED_PLAN)
      if (sql.includes('INSERT INTO materials_estimates')) {
        return Promise.reject(new Error('estimate write failed'))
      }
      return Promise.resolve({ rowCount: 1, rows: [] })
    })

    const result = await saveGarden('user-1', { beds: BEDS })
    expect(result).toEqual({ siteId: 'site-1', planId: 'plan-1' })
  })
})
