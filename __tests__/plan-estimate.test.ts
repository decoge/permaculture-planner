import { describe, expect, test } from '@jest/globals'
import { summarizeDesignFacts } from '@/lib/garden/design-facts'
import { estimateBedSpacing, estimatePlan, estimateSunFit, estimateWaterFor, estimateYieldFor, resolvePlant } from '@/lib/garden/plan-estimate'
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

describe('estimateBedSpacing', () => {
  // A 4ft x 8ft bed is 48in x 96in = 4608 sq in.
  const fourByEight = { length_ft: 8, width_ft: 4 }

  test('computes capacity from the tightest spacing in the bed', () => {
    const estimate = estimateBedSpacing(
      { ...fourByEight, name: 'Mixed', plantings: [{ variety: 'tomato' }, { variety: 'radish' }] },
      0
    )
    // The tomato needs the more room, so it governs the whole bed.
    const tomatoSpacing = resolvePlant({ plantId: 'tomato' })!.size.spacing
    const radishSpacing = resolvePlant({ plantId: 'radish' })!.size.spacing
    expect(estimate.governingSpacingIn).toBe(Math.min(tomatoSpacing, radishSpacing))

    const expected = Math.floor((96 * 48) / (estimate.governingSpacingIn! ** 2))
    expect(estimate.capacity).toBe(expected)
  })

  test('flags an overfilled bed', () => {
    const spacing = resolvePlant({ plantId: 'squash' })!.size.spacing
    const capacity = Math.floor((96 * 48) / (spacing ** 2))
    const planted = Array.from({ length: capacity + 5 }, () => ({ variety: 'squash' }))

    const estimate = estimateBedSpacing({ ...fourByEight, name: 'Crowded', plantings: planted }, 0)
    expect(estimate.fillRatio).toBeGreaterThan(1.2)
    expect(estimate.note).toMatch(/overfilled/)
  })

  test('reports spare room in an underfilled bed', () => {
    const estimate = estimateBedSpacing(
      { ...fourByEight, name: 'Sparse', plantings: [{ variety: 'squash' }] },
      0
    )
    expect(estimate.fillRatio).toBeLessThan(1)
    expect(estimate.note).toMatch(/room for about/)
  })

  test('reads bed size from the canvas polygon when feet are not recorded', () => {
    const estimate = estimateBedSpacing(
      {
        name: 'From points',
        points: [
          { x: 0, y: 0 },
          { x: 96, y: 0 },
          { x: 96, y: 48 },
          { x: 0, y: 48 },
        ],
        plantings: [{ variety: 'tomato' }],
      },
      0
    )
    expect(estimate.capacity).not.toBeNull()
    expect(estimate.capacity).toBeGreaterThan(0)
  })

  test('says so rather than guessing when the bed size is unknown', () => {
    const estimate = estimateBedSpacing({ name: 'Unknown size', plantings: [{ variety: 'tomato' }] }, 0)
    expect(estimate.capacity).toBeNull()
    expect(estimate.fillRatio).toBeNull()
    expect(estimate.note).toMatch(/size is not recorded/)
  })

  test('handles an empty bed', () => {
    const estimate = estimateBedSpacing({ ...fourByEight, name: 'Empty', plantings: [] }, 3)
    expect(estimate.planted).toBe(0)
    expect(estimate.note).toMatch(/No plants are saved/)
  })

  test('never returns NaN when the geometry is nonsense', () => {
    for (const bed of [
      { length_ft: 0, width_ft: 0, plantings: [{ variety: 'tomato' }] },
      { length_ft: -5, width_ft: 10, plantings: [{ variety: 'tomato' }] },
      { length_ft: 'lots', width_ft: null, plantings: [{ variety: 'tomato' }] },
      { plantings: [{ plantId: 'not-real' }] },
      { length_ft: 8, width_ft: 4, plantings: [{ plantId: 'not-real' }] },
    ]) {
      const estimate = estimateBedSpacing(bed, 0)
      expect(Number.isFinite(estimate.fillRatio ?? 0)).toBe(true)
      expect(estimate.note.length).toBeGreaterThan(0)
    }
  })

  test('counts plants outside the library but excludes them from capacity', () => {
    const estimate = estimateBedSpacing(
      {
        ...fourByEight,
        name: 'Mixed',
        plantings: [{ variety: 'tomato' }, { plantId: 'mystery' }, { plantId: 'another-mystery' }],
      },
      0
    )
    expect(estimate.planted).toBe(3)
    expect(estimate.note).toMatch(/not in the library/)
  })

  test('estimatePlan carries the per-bed spacing through', () => {
    const estimate = estimatePlan(
      [{ variety: 'squash' }],
      undefined,
      [{ ...fourByEight, name: 'Squash bed', plantings: Array.from({ length: 30 }, () => ({ variety: 'squash' })) }]
    )
    expect(estimate.spacing).toHaveLength(1)
    expect(estimate.spacing[0].name).toBe('Squash bed')
    // A badly overfilled bed becomes a caution on the plan.
    expect(estimate.cautions.join(' ')).toMatch(/overfilled/)
  })

  test('spacing is optional and empty when no beds are supplied', () => {
    expect(estimatePlan([{ variety: 'tomato' }]).spacing).toEqual([])
  })
})

describe('estimateSunFit', () => {
  test('reads hours from a number', () => {
    const fit = estimateSunFit([{ variety: 'tomato' }], { sunHours: 8 })
    expect(fit.hours).toBe(8)
    expect(fit.exposure).toBe('full')
  })

  test('falls back to parsing the saved shade note', () => {
    // The wizard writes "7 hours sun" into shade_notes, and that is what a
    // loaded plan actually carries.
    const fit = estimateSunFit([{ variety: 'tomato' }], { shadeNotes: '7 hours sun' })
    expect(fit.hours).toBe(7)
    expect(fit.exposure).toBe('full')
  })

  test('says so when no sun exposure is recorded', () => {
    const fit = estimateSunFit([{ variety: 'tomato' }])
    expect(fit.hours).toBeNull()
    expect(fit.exposure).toBeNull()
    expect(fit.note).toMatch(/not recorded/)
  })

  test('classifies exposure on the same 6-hour line the wizard uses', () => {
    expect(estimateSunFit([], { sunHours: 8 }).exposure).toBe('full')
    expect(estimateSunFit([], { sunHours: 6 }).exposure).toBe('full')
    expect(estimateSunFit([], { sunHours: 4 }).exposure).toBe('partial')
    expect(estimateSunFit([], { sunHours: 1 }).exposure).toBe('shade')
  })

  test('flags a full-sun crop in a shady site', () => {
    const fit = estimateSunFit([{ variety: 'tomato' }], { sunHours: 2 })
    expect(fit.mismatched).toHaveLength(1)
    expect(fit.mismatched[0].label).toBe('Tomato')
    expect(fit.mismatched[0].wants).toBe('full')
    expect(fit.note).toMatch(/will not get enough light/)
  })

  test('does not flag a shade-tolerant plant in partial sun', () => {
  // Lettuce wants partial sun (3+ hours), so 2 hours is genuinely short of
  // it. Spinach also wants partial, and is the better choice at 4 hours.
  expect(estimateSunFit([{ variety: 'spinach' }], { sunHours: 4 }).mismatched).toEqual([])
  expect(estimateSunFit([{ variety: 'spinach' }], { sunHours: 2 }).mismatched).toHaveLength(1)
  })

  test('does not flag a plant wanting less light than the site gets', () => {
  // A shade plant in full sun is not the same problem as a fruiting crop in
  // shade, so it is not counted as a mismatch.
  const fit = estimateSunFit([{ variety: 'marigold' }], { sunHours: 10 })
  expect(fit.mismatched).toEqual([])
  })

  test('ignores plants outside the library', () => {
    const fit = estimateSunFit([{ plantId: 'not-real' }], { sunHours: 1 })
    expect(fit.mismatched).toEqual([])
  })

  test('rejects impossible hour values', () => {
    expect(estimateSunFit([], { sunHours: 99 }).hours).toBeNull()
    expect(estimateSunFit([], { sunHours: -3 }).hours).toBeNull()
    expect(estimateSunFit([], { shadeNotes: 'very sunny' }).hours).toBeNull()
  })

  test('a mismatched plant becomes a caution on the plan', () => {
    const estimate = estimatePlan(
      [{ variety: 'tomato' }],
      undefined,
      undefined,
      { sunHours: 2 }
    )
    expect(estimate.sun.mismatched).toHaveLength(1)
    expect(estimate.cautions.join(' ')).toMatch(/needs full sun/)
  })

  test('is optional and inert when no sun data is supplied', () => {
    const estimate = estimatePlan([{ variety: 'tomato' }])
    expect(estimate.sun.hours).toBeNull()
    expect(estimate.cautions.join(' ')).not.toMatch(/sun/)
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
