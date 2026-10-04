import { describe, expect, test } from '@jest/globals'
import { MaterialsCalculator } from '@/lib/algorithms/materials-calculator'
import type { BedLayout } from '@/lib/algorithms/layout-generator'

function bed(overrides: Partial<BedLayout> = {}): BedLayout {
  return {
    id: 'bed-1',
    name: 'Bed 1',
    x: 0,
    y: 0,
    width: 4, // feet
    length: 8, // feet
    height: 12, // inches
    orientation: 'NS',
    hasTrellis: false,
    isWicking: false,
    pathWidth: 24, // inches
    ...overrides,
  }
}

describe('MaterialsCalculator lumber', () => {
  test('a 4x8x12 bed needs 48 linear feet of 2x10, not 80', () => {
    const estimate = new MaterialsCalculator().calculate([bed()], 'soil', false)
    const { boards2x10x8, boards2x10x10, boards2x10x12 } = estimate.lumber

    // 24 ft perimeter x 2 courses of 9.25" 2x10 = 48 linear feet.
    const linearFeet =
      boards2x10x8 * 8 + boards2x10x10 * 10 + boards2x10x12 * 12

    expect(linearFeet).toBe(48)
  })

  test('a single 4x8x12 bed is four 12ft boards', () => {
    const estimate = new MaterialsCalculator().calculate([bed()], 'soil', false)

    expect(estimate.lumber).toMatchObject({
      boards2x10x8: 0,
      boards2x10x10: 0,
      boards2x10x12: 4,
    })
  })

  test('a taller bed scales lumber linearly with course count', () => {
    const one = new MaterialsCalculator().calculate([bed({ height: 12 })], 'soil', false)
    const two = new MaterialsCalculator().calculate([bed({ height: 20 })], 'soil', false)

    const linear = (e: typeof one) =>
      e.lumber.boards2x10x8 * 8 +
      e.lumber.boards2x10x10 * 10 +
      e.lumber.boards2x10x12 * 12

    // 20" needs 3 courses vs 2, so 50% more lumber.
    expect(linear(two) / linear(one)).toBeCloseTo(1.5, 5)
  })

  test('two identical beds need twice the lumber of one', () => {
    const calc = new MaterialsCalculator()
    const one = calc.calculate([bed()], 'soil', false)
    const two = calc.calculate([bed(), bed({ id: 'bed-2' })], 'soil', false)

    const linear = (e: typeof one) =>
      e.lumber.boards2x10x8 * 8 +
      e.lumber.boards2x10x10 * 10 +
      e.lumber.boards2x10x12 * 12

    expect(linear(two)).toBe(linear(one) * 2)
  })

  test('brackets and screws scale with bed count, not lumber volume', () => {
    const estimate = new MaterialsCalculator().calculate(
      [bed(), bed({ id: 'bed-2' }), bed({ id: 'bed-3' })],
      'soil',
      false
    )

    expect(estimate.lumber.cornerBrackets).toBe(12)
    expect(estimate.lumber.screws).toBe(72)
  })
})