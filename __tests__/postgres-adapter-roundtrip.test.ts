/**
 * @jest-environment node
 *
 * The adapter must be pulled in with a dynamic import *after* jest.mock is
 * registered: a static import binds the real '@/lib/api/http' before the mock
 * factory is installed, so every call fails as 'Failed to load plan' while the
 * mock sits unused.
 */
import { beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'

const api = jest.fn<(url: string, init?: unknown) => Promise<unknown>>()

jest.mock('@/lib/api/http', () => ({
  api: (...args: unknown[]) => api(...(args as [string, unknown?])),
  ApiError: class ApiError extends Error {},
}))

type AdapterModule = typeof import('@/lib/persistence/postgres-adapter')

let PostgresPersistence: AdapterModule['PostgresPersistence']
let PLANT_LIBRARY: typeof import('@/lib/data/plant-library').PLANT_LIBRARY

beforeAll(async () => {
  // Dynamic import so jest.mock is registered before the adapter binds its
  // copy of '@/lib/api/http'.
  const adapter = await import('@/lib/persistence/postgres-adapter')
  PostgresPersistence = adapter.PostgresPersistence
  PLANT_LIBRARY = (await import('@/lib/data/plant-library')).PLANT_LIBRARY
})

const NOTES = JSON.stringify({
  points: [
    { x: 100, y: 200 },
    { x: 196, y: 200 },
    { x: 196, y: 248 },
    { x: 100, y: 248 },
  ],
  fill: '#e0f2e0',
  stroke: '#22c55e',
  width: 96,
  height: 48,
})

describe('postgres adapter round-trips canvas beds', () => {
  beforeEach(() => {
    api.mockReset()
  })

  test('geometry survives the save/load cycle unchanged', async () => {
    api.mockResolvedValue({
      name: 'My Plan',
      updated_at: '2026-01-01T00:00:00.000Z',
      canvas_metadata: { zoom: 100 },
      beds: [
        {
          id: 'bed-1',
          name: 'Bed 1',
          length_ft: 8,
          width_ft: 4,
          position_json: { x: 100, y: 200, rotation: 0 },
          notes: NOTES,
          plantings: [],
        },
      ],
    })

    const result = await new PostgresPersistence('plan-1').load()

    expect(result.success).toBe(true)
    const bed = result.data![0]
    expect(bed.width).toBe(96)
    expect(bed.height).toBe(48)
    expect(bed.points).toEqual([
      { x: 100, y: 200 },
      { x: 196, y: 200 },
      { x: 196, y: 248 },
      { x: 100, y: 248 },
    ])
    expect(bed.fill).toBe('#e0f2e0')
    expect(bed.stroke).toBe('#22c55e')
    expect(result.planName).toBe('My Plan')
  })

  test('a planted bed returns a plant id that resolves in the library', async () => {
    api.mockResolvedValue({
      beds: [
        {
          id: 'bed-1',
          notes: NOTES,
          // replaceBeds() stores the canvas plantId in the `variety` column.
          plantings: [
            {
              id: 'p1',
              variety: 'tomato',
              successions_json: { position: { x: 30, y: 40 } },
            },
          ],
        },
      ],
    })

    const result = await new PostgresPersistence('plan-1').load()
    const bed = result.data![0]

    expect(bed.plants).toHaveLength(1)
    expect(bed.plants[0].plantId).toBe('tomato')
    expect(bed.plants[0].x).toBe(30)
    expect(bed.plants[0].y).toBe(40)

    // If this fails, the canvas renders the plant as unknown and companion
    // analysis silently degrades every relationship to neutral.
    const ids = new Set(PLANT_LIBRARY.map((p) => p.id))
    expect(ids.has(bed.plants[0].plantId)).toBe(true)
  })

  test('a legacy row without JSON notes still gets usable dimensions', async () => {
    api.mockResolvedValue({
      beds: [
        {
          id: 'b',
          length_ft: 8,
          width_ft: 4,
          position_json: { x: 100, y: 200, rotation: 0 },
          notes: 'Planted via canvas editor', // free text, not JSON
          plantings: [],
        },
      ],
    })

    const result = await new PostgresPersistence('plan-1').load()

    expect(result.success).toBe(true)
    const bed = result.data![0]
    // Falls back to the stored feet, converted back to inches.
    expect(bed.width).toBe(96)
    expect(bed.height).toBe(48)
    expect(bed.points).toHaveLength(4)
  })

  test('a planting with no variety falls back instead of crashing', async () => {
    api.mockResolvedValue({ beds: [{ id: 'b', notes: null, plantings: [{ id: 'p1' }] }] })

    const result = await new PostgresPersistence('plan-1').load()

    expect(result.success).toBe(true)
    expect(result.data![0].plants[0].plantId).toBe('unknown')
  })

  test('save posts beds, metadata and plan name to the plan route', async () => {
    api.mockResolvedValue({})

    const result = await new PostgresPersistence('plan-42').save(
      [
        {
          id: 'bed-1',
          name: 'Bed 1',
          points: [
            { x: 0, y: 0 },
            { x: 48, y: 0 },
            { x: 48, y: 48 },
            { x: 0, y: 48 },
          ],
          fill: '#fff',
          stroke: '#000',
          plants: [],
        },
      ],
      { zoom: 100 },
      'Kitchen Plot'
    )

    expect(result.success).toBe(true)
    const [url, init] = api.mock.calls[0]
    expect(url).toBe('/api/plans/plan-42/beds')
    expect((init as { method: string }).method).toBe('PUT')

    const body = JSON.parse((init as { body: string }).body)
    expect(body.planName).toBe('Kitchen Plot')
    expect(body.metadata).toEqual({ zoom: 100 })
    expect(body.beds).toHaveLength(1)
  })

  test('load prefers the id argument over the adapter plan id', async () => {
    api.mockResolvedValue({ beds: [] })

    await new PostgresPersistence('plan-1').load('plan-99')

    expect(api.mock.calls[0][0]).toBe('/api/plans/plan-99')
  })

  test('a plan with no beds loads as an empty canvas, not an error', async () => {
    api.mockResolvedValue({ name: 'Empty', beds: [] })

    const result = await new PostgresPersistence('plan-1').load()

    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })
})