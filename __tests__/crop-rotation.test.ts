import { describe, expect, test } from '@jest/globals'
import { CropRotationEngine } from '@/lib/algorithms/crop-rotation'
import type { BedLayout } from '@/lib/algorithms/layout-generator'
import type { CropFamily, Season } from '@/lib/data/crops'

function bed(overrides: Partial<BedLayout> = {}): BedLayout {
  return {
    id: 'bed-1',
    name: 'Bed 1',
    x: 0,
    y: 0,
    width: 4,
    length: 8,
    height: 12,
    orientation: 'NS',
    hasTrellis: false,
    isWicking: false,
    pathWidth: 24,
    ...overrides,
  }
}

describe('CropRotationEngine.generateRotation', () => {
  test('emits no rotation violations for a plain multi-season bed', () => {
    const engine = new CropRotationEngine()
    const plan = engine.generateRotation({
      beds: [bed()],
      startSeason: 'spring',
      startYear: 2026,
      seasonsToplan: 8,
      sunExposure: 'full',
    })

    expect(plan.plantings.length).toBeGreaterThan(0)
    expect(plan.warnings.filter(w => w.includes('repeated in bed'))).toEqual([])
  })

  test('does not repeat a crop family in the same bed within two years', () => {
    const engine = new CropRotationEngine()
    const plan = engine.generateRotation({
      beds: [bed()],
      startSeason: 'spring',
      startYear: 2026,
      seasonsToplan: 8,
      sunExposure: 'full',
    })

    const byKey = new Map<string, CropFamily>()
    for (const planting of plan.plantings) {
      const key = `${planting.year}:${planting.season}`
      const previous = byKey.get(`${planting.bedId}:${key}`)
      if (previous) {
        expect({ key, family: planting.family }).toEqual({ key, family: previous })
      }
      byKey.set(`${planting.bedId}:${key}`, planting.family)
    }

    // Compare every pair within a 2-year window (8 seasons).
    for (let i = 0; i < plan.plantings.length; i++) {
      for (let j = i + 1; j < plan.plantings.length; j++) {
        const a = plan.plantings[i]
        const b = plan.plantings[j]
        const seasonIndex = (s: Season) => ['spring', 'summer', 'fall', 'winter'].indexOf(s)
        const gap = (b.year - a.year) * 4 + (seasonIndex(b.season) - seasonIndex(a.season))
        if (gap < 8) {
          expect({ gap, same: a.family === b.family }).toEqual({ gap, same: false })
        }
      }
    }
  })

  test('bed spacing reflects the widest crop assigned', () => {
    const engine = new CropRotationEngine()
    const plan = engine.generateRotation({
      beds: [bed()],
      startSeason: 'spring',
      startYear: 2026,
      seasonsToplan: 1,
      sunExposure: 'full',
    })

    for (const planting of plan.plantings) {
      const widest = Math.max(...planting.crops.map(c => c.spacing_in))
      expect(planting.spacing).toBe(widest)
    }
  })

  test('avoidFamilies excludes those families entirely', () => {
    const engine = new CropRotationEngine()
    const avoid: CropFamily[] = ['Solanaceae']
    const plan = engine.generateRotation({
      beds: [bed()],
      startSeason: 'spring',
      startYear: 2026,
      seasonsToplan: 8,
      sunExposure: 'full',
      avoidFamilies: avoid,
    })

    for (const planting of plan.plantings) {
      expect(avoid).not.toContain(planting.family)
    }
  })

  test('suggestions reflect bed features', () => {
    const engine = new CropRotationEngine()
    const plan = engine.generateRotation({
      beds: [bed({ hasTrellis: true }), bed({ id: 'bed-2', isWicking: true })],
      startSeason: 'spring',
      startYear: 2026,
      seasonsToplan: 1,
      sunExposure: 'partial',
    })

    expect(plan.suggestions.join(' ')).toMatch(/trellis/i)
    expect(plan.suggestions.join(' ')).toMatch(/wicking/i)
    expect(plan.suggestions.join(' ')).toMatch(/partial shade/i)
  })
})

describe('CropRotationEngine.generateSuccessionPlanting', () => {
  test('only returns sowings that finish before the end date', () => {
    const engine = new CropRotationEngine()
    const crop = {
      id: 'radish',
      name: 'Radish',
      family: 'Brassicaceae' as CropFamily,
      sun: 'full' as const,
      spacing_in: 2,
      days_to_maturity: 25,
      seasons: ['spring'] as Season[],
      row_cover_suitable: true,
      needs_pollination: false,
      water_needs: 'medium' as const,
    }

    const start = new Date('2026-04-01')
    const end = new Date('2026-06-30')
    const dates = engine.generateSuccessionPlanting(crop, start, end, 14)

    expect(dates.length).toBeGreaterThan(0)
    for (const date of dates) {
      const harvest = new Date(date)
      harvest.setDate(harvest.getDate() + crop.days_to_maturity)
      expect(harvest <= end).toBe(true)
    }
    // Sowings are spaced by the interval and start at the start date.
    expect(dates[0].toISOString().slice(0, 10)).toBe('2026-04-01')
    const gapDays = (dates[1].getTime() - dates[0].getTime()) / 86400000
    expect(gapDays).toBe(14)
  })

  test('returns nothing when the season is too short to mature', () => {
    const engine = new CropRotationEngine()
    const crop = {
      id: 'watermelon',
      name: 'Watermelon',
      family: 'Cucurbitaceae' as CropFamily,
      sun: 'full' as const,
      spacing_in: 36,
      days_to_maturity: 100,
      seasons: ['summer'] as Season[],
      row_cover_suitable: false,
      needs_pollination: true,
      water_needs: 'high' as const,
    }

    const dates = engine.generateSuccessionPlanting(
      crop,
      new Date('2026-05-01'),
      new Date('2026-06-01'),
      14
    )
    expect(dates).toEqual([])
  })
})