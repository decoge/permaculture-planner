/**
 * @jest-environment node
 *
 * replaceBeds is reached through updateGarden, which wraps it in a
 * transaction. The client is mocked so the assertions are about the statements
 * it issues, not about a live database.
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'

const query = jest.fn<(sql: string, params?: unknown[]) => Promise<unknown[]>>()
// updateGarden reads `.rowCount` and `.rows` off the client result, so the mock
// must return the pg result shape rather than a bare array.
const clientQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: unknown[] }>>()

jest.mock('@/lib/db/pool', () => ({
  query: (sql: string, params?: unknown[]) => query(sql, params),
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

// The plan lookup inside updateGarden.
const PLAN_ROW = {
  id: 'plan-1',
  site_id: 'site-1',
  name: 'Plan',
  version: 1,
  constraints_json: {},
}

let updateGarden: typeof import('@/lib/db/gardens')['updateGarden']

beforeEach(async () => {
  query.mockReset()
  clientQuery.mockReset()
  query.mockResolvedValue([PLAN_ROW])
  clientQuery.mockResolvedValue({ rowCount: 1, rows: [PLAN_ROW] })
  const gardens = await import('@/lib/db/gardens')
  updateGarden = gardens.updateGarden
})

function statements() {
  return clientQuery.mock.calls.map((call) => call[0] as string)
}

/** Find the params of the single statement whose SQL contains `fragment`. */
function paramsFor(fragment: string): unknown[] {
  const call = clientQuery.mock.calls.find((sql) => (sql[0] as string).includes(fragment))
  if (!call) throw new Error(`no statement containing ${JSON.stringify(fragment)}`)
  return call[1] as unknown[]
}

describe('updateGarden writes the canvas in a fixed number of statements', () => {
  test('a garden with many beds and plants still uses a fixed number of statements', async () => {
    const manyBeds = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `bed-${index}`,
        name: `Bed ${index + 1}`,
        plants: Array.from({ length: 5 }, (_, plantIndex) => ({
          id: `plant-${index}-${plantIndex}`,
          plantId: 'tomato',
          x: plantIndex * 10,
          y: plantIndex * 10,
        })),
      }))

    const result = await updateGarden('user-1', 'plan-1', manyBeds(20))
    expect(result).toEqual({ planId: 'plan-1', siteId: 'site-1' })

    // One plan lookup, two UPDATE statements, a delete, then the two batched
    // inserts. 20 beds and 100 plants used to cost 21 extra statements here;
    // now the canvas is always exactly three regardless of its size.
    const withTwenty = clientQuery.mock.calls.length
    expect(withTwenty).toBe(6)

    clientQuery.mockClear()
    await updateGarden('user-1', 'plan-1', manyBeds(2))
    expect(clientQuery.mock.calls.length).toBe(withTwenty)
  })

  test('plantings reference the bed ids the bed insert actually wrote', async () => {
    await updateGarden('user-1', 'plan-1', [
      { id: 'bed-a', name: 'Bed A', plants: [{ id: 'p1', plantId: 'tomato' }] },
      { id: 'bed-b', name: 'Bed B', plants: [{ id: 'p2', plantId: 'carrot' }] },
    ])

    const bedIds = paramsFor('INSERT INTO beds')[1] as string[]
    const plantingBedIds = paramsFor('INSERT INTO plantings')[3] as string[]

    expect(bedIds).toEqual(['uuid:bed-a', 'uuid:bed-b'])
    // Every planting's bed_id is one the beds insert just wrote.
    for (const id of plantingBedIds) expect(bedIds).toContain(id)
    expect(plantingBedIds).toEqual(['uuid:bed-a', 'uuid:bed-b'])
  })

  test('omits the plantings insert when no bed has any plants', async () => {
    await updateGarden('user-1', 'plan-1', [{ id: 'bed-a', name: 'Bed A' }])

    const sql = statements().join('\n')
    expect(sql).toContain('DELETE FROM beds')
    expect(sql).toContain('INSERT INTO beds')
    expect(sql).not.toContain('INSERT INTO plantings')
  })

  test('an empty canvas deletes the beds and inserts nothing', async () => {
    await updateGarden('user-1', 'plan-1', [])

    const sql = statements().join('\n')
    expect(sql).toContain('DELETE FROM beds')
    expect(sql).not.toContain('INSERT INTO beds')
    expect(sql).not.toContain('INSERT INTO plantings')
  })

  test('bed geometry still lands in the batched insert', async () => {
    await updateGarden('user-1', 'plan-1', [
      { id: 'bed-a', name: 'Bed A', width: 96, height: 48, rotation: 90 },
    ])

    const params = paramsFor('INSERT INTO beds')
    // names, then length_ft, width_ft, height_in derived from the canvas size.
    expect(params[2]).toEqual(['Bed A'])
    expect(params[3]).toEqual([8])
    expect(params[4]).toEqual([4])
    // rotation 90 is a 90-degree turn, so the bed runs east-west.
    expect(params[6]).toEqual(['EW'])
  })
})
