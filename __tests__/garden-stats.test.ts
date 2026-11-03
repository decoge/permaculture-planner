/**
 * The editor's status line. A bed loaded from the store carries no
 * `elementCategory`, and treating "not 'bed'" as an element made the demo
 * garden report its two beds as elements until the first canvas edit filled the
 * field in.
 */
import { describe, expect, test } from '@jest/globals'
import { countGardenItems } from '@/lib/garden/garden-stats'
import type { GardenBed } from '@/lib/garden/garden-types'

function bed(overrides: Partial<GardenBed> = {}): GardenBed {
  return {
    id: 'bed-1',
    name: 'Bed',
    points: [],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants: [],
    ...overrides,
  }
}

describe('countGardenItems', () => {
  test('a bed without an elementCategory is a bed, not an element', () => {
    const counts = countGardenItems([
      bed({ id: 'herb', plants: [{ id: 'p1', plantId: 'basil', x: 0, y: 0 }] }),
      bed({ id: 'veg', plants: [{ id: 'p2', plantId: 'tomato', x: 0, y: 0 }] }),
    ])

    expect(counts).toEqual({ beds: 2, plants: 2, elements: 0 })
  })

  test('an explicit bed category is still a bed', () => {
    expect(countGardenItems([bed({ elementCategory: 'bed' })])).toEqual({
      beds: 1,
      plants: 0,
      elements: 0,
    })
  })

  test('a placed element counts once, and its plants still count', () => {
    const counts = countGardenItems([
      bed({ id: 'pond', elementCategory: 'water_management', elementType: 'pond' }),
      bed({ id: 'bed-1', elementCategory: 'bed', plants: [{ id: 'p1', plantId: 'basil', x: 0, y: 0 }] }),
    ])

    expect(counts).toEqual({ beds: 1, plants: 1, elements: 1 })
  })

  test('an empty canvas is all zeroes', () => {
    expect(countGardenItems([])).toEqual({ beds: 0, plants: 0, elements: 0 })
  })
})
