/**
 * DataAdapter is the canvas's save/load boundary: GardenBed[] in, tldraw shapes
 * out, and back again. Anything it drops or throws on is a bed the user loses,
 * and the shape meta it reads is persisted in the tldraw document, so it can
 * arrive corrupted from an older version or a bad write.
 */
import { describe, expect, test } from '@jest/globals'
import { DataAdapter } from '@/components/tldraw/data-adapter'
import type { GardenBed } from '@/lib/garden/garden-types'

const adapter = new DataAdapter()

function bed(overrides: Partial<GardenBed> = {}): GardenBed {
  return {
    id: 'bed-1',
    name: 'Bed One',
    points: [
      { x: 100, y: 200 },
      { x: 196, y: 200 },
      { x: 196, y: 248 },
      { x: 100, y: 248 },
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants: [],
    width: 96,
    height: 48,
    rotation: 0,
    ...overrides,
  }
}

describe('DataAdapter round trip', () => {
  test('keeps a bed id, name and numbers through save/load', () => {
    const shapes = adapter.gardenBedsToShapes([bed()])
    const beds = adapter.shapesToGardenBeds(shapes)

    expect(beds).toHaveLength(1)
    expect(beds[0].id).toBe('bed-1')
    expect(beds[0].name).toBe('Bed One')
    expect(beds[0].width).toBe(96)
    expect(beds[0].height).toBe(48)
  })

  test('keeps the plants attached to their bed', () => {
    const shapes = adapter.gardenBedsToShapes([
      bed({ plants: [{ id: 'plant-1', plantId: 'tomato', x: 20, y: 20 }] }),
    ])
    const beds = adapter.shapesToGardenBeds(shapes)

    expect(beds[0].plants).toHaveLength(1)
    expect(beds[0].plants[0].plantId).toBe('tomato')
  })
})

describe('DataAdapter corrupt persisted data', () => {
  test('a malformed metadata blob leaves the bed loadable', () => {
    const shapes = adapter.gardenBedsToShapes([bed()])
    // Simulate a bad write / older version: the points blob stays valid, the
    // metadata one does not. This used to throw and empty the canvas.
    const corrupted = shapes.map((shape) =>
      shape.type === 'bed'
        ? { ...shape, meta: { ...shape.meta, metadataJson: '{"half":' } }
        : shape
    )

    let beds: GardenBed[] = []
    expect(() => {
      beds = adapter.shapesToGardenBeds(corrupted)
    }).not.toThrow()

    expect(beds).toHaveLength(1)
    expect(beds[0].id).toBe('bed-1')
    expect(beds[0].metadata).toBeUndefined()
  })

  test('a malformed points blob yields a usable rectangle instead of throwing', () => {
    const shapes = adapter.gardenBedsToShapes([bed()])
    const corrupted = shapes.map((shape) =>
      shape.type === 'bed' ? { ...shape, props: { ...shape.props, pointsJson: 'not json' } } : shape
    )

    const beds = adapter.shapesToGardenBeds(corrupted)

    expect(beds).toHaveLength(1)
    expect(beds[0].points.length).toBeGreaterThanOrEqual(4)
  })
})

describe('DataAdapter elements', () => {
  const pond = bed({
    id: 'pond-1',
    name: 'Pond',
    elementType: 'pond',
    elementCategory: 'water_management',
    fill: '#bfdbfe',
    stroke: '#1d4ed8',
  })

  test('a saved element comes back as a GardenBed entry, not as a bed', () => {
    const shapes = adapter.gardenBedsToShapes([pond])
    expect(shapes).toHaveLength(1)
    expect(shapes[0].type).toBe('element')

    const [restored] = adapter.shapesToGardenBeds(shapes)
    expect(restored).toMatchObject({
      id: 'pond-1',
      name: 'Pond',
      elementCategory: 'water_management',
      elementType: 'pond',
      width: 96,
      height: 48,
    })
  })

  test('an element shape placed on the canvas is kept in the plan', () => {
    // The element tool creates a `element` shape, and this conversion is what
    // puts it into GardenBed[] — without it a pond the user placed vanished at
    // the next autosave and never reached the saved plan.
    const elementShape = {
      id: 'shape:pond-2',
      type: 'element',
      x: 40,
      y: 60,
      rotation: 0,
      props: {
        w: 100,
        h: 80,
        name: 'pond',
        subtype: 'pond',
        category: 'water_management',
        color: '#1d4ed8',
        fill: '#bfdbfe',
        pointsJson: '[]',
        zone: -1,
        capacity: 250,
        material: '',
        flowDirection: '',
        connectedIds: '[]',
        metadataJson: '{"capacity":250}',
      },
      meta: {},
    }

    const beds = adapter.shapesToGardenBeds([elementShape as never])

    expect(beds).toHaveLength(1)
    expect(beds[0]).toMatchObject({
      id: 'pond-2',
      name: 'pond',
      elementCategory: 'water_management',
      elementType: 'pond',
      width: 100,
      height: 80,
      plants: [],
    })
    expect(beds[0].metadata).toEqual({ capacity: 250 })
  })

  test('a plain bed still becomes a bed shape', () => {
    const shapes = adapter.gardenBedsToShapes([bed()])

    expect(shapes[0].type).toBe('bed')
  })
})

