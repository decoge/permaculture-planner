/**
 * MaterialsCalculator is what the shopping list reads: saveGarden writes its
 * output into materials_estimates on a plan's first save, so a wrong figure
 * ends up as a quantity the user buys.
 *
 * The case these pin: a bed's orientation on the canvas (x-extent vs y-extent)
 * must not change the materials it needs.
 */
import { describe, expect, test } from '@jest/globals'
import { MaterialsCalculator } from '@/lib/algorithms/materials-calculator'
import type { GardenBed } from '@/lib/garden/garden-types'

function bed(widthIn: number, heightIn: number): GardenBed {
  return {
    id: 'bed-1',
    name: 'Bed',
    points: [
      { x: 0, y: 0 },
      { x: widthIn, y: 0 },
      { x: widthIn, y: heightIn },
      { x: 0, y: heightIn },
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants: [],
    width: widthIn,
    height: heightIn,
    rotation: 0,
  }
}

const calculator = new MaterialsCalculator()

describe('MaterialsCalculator drip irrigation', () => {
  test('an 8x4 bed needs the same drip line whichever way it is drawn', () => {
    const wide = calculator.calculateFromGardenBeds([bed(96, 48)], 12, 'soil', true)
    const tall = calculator.calculateFromGardenBeds([bed(48, 96)], 12, 'soil', true)

    // 8 ft along the long side, two laterals across the 4 ft short side.
    expect(wide.irrigation.dripLineFt).toBe(16)
    expect(tall.irrigation.dripLineFt).toBe(16)
    expect(wide.irrigation.emitters).toBe(16)
    expect(tall.irrigation.emitters).toBe(16)
  })

  test('a 2 ft bed gets one lateral; a 3 ft bed gets two', () => {
    const narrow = calculator.calculateFromGardenBeds([bed(96, 24)], 12, 'soil', true)
    const wider = calculator.calculateFromGardenBeds([bed(96, 36)], 12, 'soil', true)

    expect(narrow.irrigation.dripLineFt).toBe(8)
    expect(wider.irrigation.dripLineFt).toBe(16)
  })
})

describe('MaterialsCalculator path mulch', () => {
  test('path mulch does not depend on which side is called length', () => {
    const wide = calculator.calculateFromGardenBeds([bed(96, 48)], 12, 'soil', false)
    const tall = calculator.calculateFromGardenBeds([bed(48, 96)], 12, 'soil', false)

    expect(wide.mulch.cubicFeet).toBe(tall.mulch.cubicFeet)
  })
})
