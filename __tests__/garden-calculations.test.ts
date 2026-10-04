import { describe, expect, test } from '@jest/globals'
import {
  calculateExpectedYield,
  calculateROI,
  type YieldCalculationInput,
} from '@/lib/calculations/garden-calculations'

function yieldInput(
  conditions: Partial<YieldCalculationInput['conditions']>,
  plants: YieldCalculationInput['plants'] = [
    { name: 'Tomato', type: 'tomato', quantity: 10 },
  ],
): YieldCalculationInput {
  return {
    plants,
    conditions: {
      soil: 'good',
      sun: 'full',
      water: 'adequate',
      ...conditions,
    },
    experience: 'experienced',
    method: 'traditional',
    season: 'summer',
  }
}

describe('calculateExpectedYield conditions', () => {
  test('optimal water is not scored worse than adequate water', () => {
    const adequate = calculateExpectedYield(yieldInput({ water: 'adequate' }))
    const optimal = calculateExpectedYield(yieldInput({ water: 'optimal' }))

    // More water can never mean a lower projected yield.
    expect(optimal.totalYieldPounds).toBeGreaterThanOrEqual(adequate.totalYieldPounds)
  })

  test('good soil with optimal water beats fair soil with adequate water', () => {
    const good = calculateExpectedYield(yieldInput({ soil: 'good', water: 'optimal' }))
    const fair = calculateExpectedYield(yieldInput({ soil: 'fair', water: 'adequate' }))

    expect(good.totalYieldPounds).toBeGreaterThan(fair.totalYieldPounds)
  })

  test('degrading any single condition never increases yield', () => {
    const base = yieldInput({ soil: 'excellent', sun: 'full', water: 'optimal' })
    const baseline = calculateExpectedYield(base).totalYieldPounds

    const degradations: Array<Partial<YieldCalculationInput['conditions']>> = [
      { soil: 'poor' },
      { sun: 'shade' },
      { water: 'insufficient' },
    ]

    for (const worse of degradations) {
      const degraded = calculateExpectedYield({ ...base, conditions: { ...base.conditions, ...worse } })
      expect(degraded.totalYieldPounds).toBeLessThanOrEqual(baseline)
    }
  })

  test('excellent conditions outperform poor ones', () => {
    const excellent = calculateExpectedYield(yieldInput({ soil: 'excellent', water: 'optimal' }))
    const poor = calculateExpectedYield(yieldInput({ soil: 'poor', water: 'insufficient' }))

    expect(excellent.totalYieldPounds).toBeGreaterThan(poor.totalYieldPounds)
  })
})

describe('calculateROI', () => {
  const emptyYield = {
    ...calculateExpectedYield(yieldInput({ soil: 'good', water: 'adequate' })),
    byPlant: [],
  }

  test('does not report Infinity when the garden has no market value', () => {
    const roi = calculateROI(500, 100, emptyYield)

    expect(Number.isFinite(roi.breakEvenMonths)).toBe(true)
    expect(Number.isFinite(roi.firstYearROI)).toBe(true)
    expect(Number.isFinite(roi.fiveYearROI)).toBe(true)
    // A garden that never earns anything never breaks even; 0 means
    // "no break-even point", not "breaks even immediately".
    expect(roi.breakEvenMonths).toBe(0)
  })

  test('serializes to valid JSON with a zero-value garden', () => {
    const roi = calculateROI(500, 100, emptyYield)

    expect(JSON.parse(JSON.stringify(roi))).toEqual(roi)
  })

  test('break-even months shrink as setup cost falls', () => {
    const garden = calculateExpectedYield(
      yieldInput({}, [{ name: 'T', type: 'tomato', quantity: 20 }])
    )

    expect(calculateROI(100, 100, garden).breakEvenMonths).toBeLessThan(
      calculateROI(1000, 100, garden).breakEvenMonths
    )
  })
})