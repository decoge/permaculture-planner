import { describe, expect, test } from '@jest/globals'
import { summarizeDesignFacts } from '@/lib/garden/design-facts'
import { estimatePlan, estimateWaterFor, estimateYieldFor, resolvePlant } from '@/lib/garden/plan-estimate'
import { PLANT_LIBRARY } from '@/lib/data/plant-library'
import { PLANT_YIELD_DATABASE } from '@/lib/data/plant-yield-data'

function bed(name: string, varieties: string[]) {
  return { name, plantings: varieties.map((variety) => ({ variety })) }
}

describe('estimatePlan', () => {
  test('produces finite numbers for an empty plan', () => {
    const estimate = estimatePlan([])
    expect(estimate.water.gallonsPerWeek).toBe(0)
    expect(estimate.yield.totalPounds).toBe(0)
    expect(estimate.yield.totalValue).toBe(0)
    expect(Number.isFinite(estimate.score)).toBe(true)
    // Nothing is planted, so there is no ROI to state.
    expect(estimate.roi.setupCost).toBeNull()
    expect(estimate.roi.firstYearNet).toBeNull()
    expect(estimate.roi.breakEvenYears).toBeNull()
  })

  test('uses the measured figure when the plant has yield data', () => {
    const tomato = estimateYieldFor(resolvePlant({ plantId: 'tomato' }), { plantId: 'tomato' }, 4)
    const measured = PLANT_YIELD_DATABASE.tomato

    expect(tomato.source).toBe('database')
    expect(tomato.poundsPerPlant).toBe(measured.yieldPerPlant.average)
    expect(tomato.totalPounds).toBeCloseTo(measured.yieldPerPlant.average * 4, 6)
    expect(tomato.value).toBeCloseTo(measured.yieldPerPlant.average * 4 * measured.marketPrice, 6)
  })

  test('falls back to the category when there is no measured data', () => {
    // Rhododendron is in the library but not in the yield database.
    const rhodo = resolvePlant({ plantId: 'rhododendron' })
    expect(rhodo).not.toBeNull()

    const estimate = estimateYieldFor(rhodo, { plantId: 'rhododendron' }, 2)
    expect(estimate.source).toBe('category')
    expect(estimate.poundsPerPlant).toBeGreaterThan(0)
    expect(estimate.totalPounds).toBeCloseTo(estimate.poundsPerPlant * 2, 6)
  })

  test('counts repeated plants of one kind once, with the count applied', () => {
    const estimate = estimatePlan([{ variety: 'tomato' }, { variety: 'tomato' }, { variety: 'tomato' }])
    expect(estimate.yield.varieties).toBe(1)

    const tomato = estimate.yield.byPlant.find((row) => row.plantId === 'tomato')
    expect(tomato?.count).toBe(3)
    expect(tomato?.totalPounds).toBeCloseTo(
      PLANT_YIELD_DATABASE.tomato.yieldPerPlant.average * 3,
      6
    )
  })

  test('sums water across every planting', () => {
    const perPlant = PLANT_YIELD_DATABASE.tomato.waterPerWeek.base
    const estimate = estimatePlan([{ variety: 'tomato' }, { variety: 'tomato' }])
    expect(estimate.water.gallonsPerWeek).toBeCloseTo(perPlant * 2, 6)
    expect(estimate.water.gallonsPerDay).toBeCloseTo((perPlant * 2) / 7, 6)
  })

  test('reports the peak demand above the base week', () => {
    const estimate = estimatePlan([{ variety: 'tomato' }])
    expect(estimate.water.peakGallonsPerWeek).toBeGreaterThan(estimate.water.gallonsPerWeek)
  })

  test('never returns NaN for an unrecognised plant', () => {
    const estimate = estimatePlan([
      { plantId: 'not-a-real-plant' },
      { variety: 'also-not-real' },
      {},
      { plantId: null },
    ])

    expect(Number.isFinite(estimate.water.gallonsPerWeek)).toBe(true)
    expect(Number.isFinite(estimate.yield.totalPounds)).toBe(true)
    expect(Number.isFinite(estimate.yield.totalValue)).toBe(true)
    expect(Number.isFinite(estimate.score)).toBe(true)
    expect(estimate.water.notes.join(' ')).toMatch(/could not be matched/)
  })

  test('is not derailed by a non-array argument', () => {
    expect(Number.isFinite(estimatePlan('nonsense' as never).water.gallonsPerWeek)).toBe(true)
  })

  test('gives a first-year net once a cost is recorded', () => {
    const estimate = estimatePlan([{ variety: 'tomato' }], 5000)
    expect(estimate.roi.setupCost).toBe(5000)
    expect(estimate.roi.firstYearNet).not.toBeNull()
    expect(typeof estimate.roi.firstYearNet).toBe('number')
  })

  test('break-even is null when the first year already pays back', () => {
    const estimate = estimatePlan([{ variety: 'tomato' }, { variety: 'tomato' }], 1)
    // A one-cent cost is repaid immediately, so there is nothing to wait for.
    expect(estimate.roi.breakEvenYears).toBeNull()
  })

  test('scores a varied plan above a monoculture', () => {
    const mono = estimatePlan([{ variety: 'tomato' }, { variety: 'tomato' }])
    const varied = estimatePlan([
      { variety: 'tomato' },
      { variety: 'lettuce' },
      { variety: 'carrot' },
      { variety: 'beans' },
      { variety: 'apple' },
      { variety: 'marigold' },
    ])

    expect(varied.score).toBeGreaterThan(mono.score)
    // The monoculture is warned about its narrow base; the varied plan is not,
    // because six varieties is exactly what the check is looking for.
    expect(mono.cautions.join(' ')).toMatch(/varieties/)
    expect(varied.cautions.join(' ')).not.toMatch(/vulnerable to a single pest/)
  })

  test('credits a legume and notes a perennial when present', () => {
    const estimate = estimatePlan([{ variety: 'beans' }, { variety: 'apple' }])
    expect(estimate.strengths.join(' ')).toMatch(/nitrogen/)
    expect(estimate.strengths.join(' ')).toMatch(/[Pp]erennial/)
  })

  test('warns about a high water plan', () => {
    const many = Array.from({ length: 200 }, () => ({ variety: 'tomato' }))
    const estimate = estimatePlan(many)
    expect(estimate.cautions.join(' ')).toMatch(/gallons/)
  })

  test('keeps the score inside 0-100', () => {
    const everyPlant = PLANT_LIBRARY.map((plant) => ({ plantId: plant.id }))
    expect(estimatePlan(everyPlant).score).toBeLessThanOrEqual(100)
    expect(estimatePlan([]).score).toBeGreaterThanOrEqual(0)
  })
})

describe('estimateWaterFor', () => {
  test('prefers the measured database figure', () => {
    const estimate = estimateWaterFor(resolvePlant({ plantId: 'tomato' }), { plantId: 'tomato' })
    expect(estimate.source).toBe('database')
    expect(estimate.gallonsPerWeek).toBe(PLANT_YIELD_DATABASE.tomato.waterPerWeek.base)
  })

  test('uses the library band when there is no measured figure', () => {
    const rose = PLANT_LIBRARY.find((plant) => plant.id === 'marigold')
    const estimate = estimateWaterFor(rose || null, { plantId: 'marigold' })
    expect(['database', 'library', 'category']).toContain(estimate.source)
    expect(estimate.gallonsPerWeek).toBeGreaterThan(0)
  })

  test('still returns a usable figure for an unknown plant', () => {
    const estimate = estimateWaterFor(null, { plantId: 'mystery' })
    expect(estimate.gallonsPerWeek).toBeGreaterThan(0)
    expect(estimate.label).toBe('mystery')
  })
})

describe('resolvePlant', () => {
  test('finds by plantId', () => {
    expect(resolvePlant({ plantId: 'tomato' })?.name).toBe('Tomato')
  })

  test('finds by variety, which is what the database stores', () => {
    expect(resolvePlant({ variety: 'tomato' })?.id).toBe('tomato')
    expect(resolvePlant({ variety: 'Tomato' })?.id).toBe('tomato')
  })

  test('finds by display name', () => {
    expect(resolvePlant({ name: 'Tomato' })?.id).toBe('tomato')
  })

  test('returns null for something not in the library', () => {
    expect(resolvePlant({ plantId: 'not-real' })).toBeNull()
    expect(resolvePlant({})).toBeNull()
  })
})

describe('the facts panels report real estimates', () => {
  test('analytics and critique carry water, yield and score figures', () => {
    const facts = summarizeDesignFacts({
      beds: [bed('Salad Greens', ['lettuce', 'tomato', 'carrot'])],
    })

    // These were placeholders reading "A design score is not recorded." and
    // "Yields are not recorded." before estimation was wired in.
    expect(facts.critique.join('\n')).toMatch(/Design score is \d+ out of 100/)
    expect(facts.analytics.join('\n')).toMatch(/Water demand is about [\d.]+ gallons a week/)
    expect(facts.analytics.join('\n')).toMatch(/Projected yield is about [\d.]+ lbs a year/)
    expect(facts.analytics).toContain('3 varieties are planted.')
  })

  test('with no plants it says so instead of inventing a score', () => {
    const facts = summarizeDesignFacts({})
    expect(facts.analytics).toContain('Water, yield and return cannot be estimated without plants.')
    expect(facts.analytics).toContain('Performance score is not recorded.')
  })

  test('a recorded cost produces a return line', () => {
    const facts = summarizeDesignFacts({
      materials: { costEstimateCents: 5000 },
      beds: [bed('Salad Greens', ['tomato', 'tomato'])],
    })
    expect(facts.analytics).toContain('Build cost is recorded as 5000 cents.')
    expect(facts.analytics.join('\n')).toMatch(/First-year net is about -?[\d.]+ dollars/)
  })
})
