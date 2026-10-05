import { describe, expect, test } from '@jest/globals'
import {
  calculateExpectedYield,
  calculateOptimalSpacing,
  calculateWaterRequirements,
} from '@/lib/calculations/garden-calculations'

/**
 * These calculators take values typed as closed unions but receive them from
 * saved plans and JSON, so an unrecognised key is a runtime possibility. Every
 * lookup therefore needs a neutral fallback -- an unknown key used to multiply
 * through to NaN and render as "NaN gallons".
 */
describe('calculators never return NaN for unrecognised input', () => {
  test('calculateWaterRequirements with an unknown water need', () => {
    const result = calculateWaterRequirements({
      plants: [{ type: 'mystery', waterNeeds: 'enormous', squareFeet: 100 }],
    } as never)

    expect(Number.isFinite(result.dailyGallons)).toBe(true)
    expect(Number.isFinite(result.weeklyGallons)).toBe(true)
    expect(Number.isFinite(result.monthlyGallons)).toBe(true)
    expect(Number.isFinite(result.peakSummerGallons)).toBe(true)
  })

  test('calculateWaterRequirements with unknown climate, season and soil', () => {
    const result = calculateWaterRequirements({
      climate: 'meteor',
      season: 'monsoon',
      soilType: 'volcanic',
      irrigationMethod: 'drip',
      plants: [{ type: 'tomato', waterNeeds: 'high', squareFeet: 100 }],
    } as never)

    expect(Number.isFinite(result.dailyGallons)).toBe(true)
    expect(result.dailyGallons).toBeGreaterThan(0)
  })

  test('calculateWaterRequirements with a non-numeric area', () => {
    const result = calculateWaterRequirements({
      plants: [{ type: 'tomato', waterNeeds: 'high', squareFeet: 'lots' }],
    } as never)

    expect(Number.isFinite(result.dailyGallons)).toBe(true)
    expect(Number.isFinite(result.weeklyGallons)).toBe(true)
  })

  test('calculateOptimalSpacing with an unknown method and growth habit', () => {
    const result = calculateOptimalSpacing({
      bedDimensions: { width: 4, length: 8 },
      method: 'telepathy',
      plants: [
        {
          type: 'tomato',
          mature_width: 24,
          growth_habit: 'chaotic',
          quantity: 4,
        },
      ],
    } as never)

    expect(Number.isFinite(result.totalPlantsSupported)).toBe(true)
    expect(Number.isFinite(result.squareFeetNeeded)).toBe(true)
    for (const row of result.layout) {
      expect(Number.isFinite(row.spacing)).toBe(true)
      expect(row.spacing).toBeGreaterThan(0)
    }
  })

  test('calculateExpectedYield with an unknown experience and method', () => {
    const result = calculateExpectedYield({
      conditions: { soil: 'excellent', water: 'optimal' },
      experience: 'godlike',
      method: 'aerobic',
      plants: [{ type: 'tomato', quantity: 4 }],
    } as never)

    expect(Number.isFinite(result.totalYieldPounds)).toBe(true)
    expect(result.totalYieldPounds).toBeGreaterThan(0)
    expect(Number.isFinite(result.nutritionalValue.estimatedCalories)).toBe(true)
    expect(result.nutritionalValue.estimatedCalories).toBeGreaterThan(0)
  })
})

describe('known-good input still uses the real modifiers', () => {
  test('an unknown water need falls back to the medium rate, not zero or NaN', () => {
    // MEDIUM is 0.62/sqft/week in temperate summer on loamy soil.
    const medium = calculateWaterRequirements({
      climate: 'temperate',
      season: 'summer',
      soilType: 'loamy',
      plants: [{ type: 'a', quantity: 1, waterNeeds: 'medium', squareFeet: 100 }],
    })
    const unknown = calculateWaterRequirements({
      climate: 'temperate',
      season: 'summer',
      soilType: 'loamy',
      plants: [{ type: 'a', quantity: 1, waterNeeds: 'enormous', squareFeet: 100 }],
    } as never)

    expect(unknown.dailyGallons).toBeCloseTo(medium.dailyGallons, 5)
  })

  test('an unknown climate falls back to temperate', () => {
    const temperate = calculateWaterRequirements({
      climate: 'temperate',
      season: 'summer',
      soilType: 'loamy',
      plants: [{ type: 'a', quantity: 1, waterNeeds: 'high', squareFeet: 100 }],
    })
    const unknown = calculateWaterRequirements({
      climate: 'meteor',
      season: 'summer',
      soilType: 'loamy',
      plants: [{ type: 'a', quantity: 1, waterNeeds: 'high', squareFeet: 100 }],
    } as never)

    expect(unknown.dailyGallons).toBeCloseTo(temperate.dailyGallons, 5)
  })

  test('a real high water need still differs from medium', () => {
    const high = calculateWaterRequirements({
      plants: [{ type: 'a', quantity: 1, waterNeeds: 'high', squareFeet: 100 }],
    })
    const medium = calculateWaterRequirements({
      plants: [{ type: 'a', quantity: 1, waterNeeds: 'medium', squareFeet: 100 }],
    })

    expect(high.dailyGallons).toBeGreaterThan(medium.dailyGallons)
  })

  test('an unknown growth habit falls back to standard, matching a real standard plant', () => {
    const withHabit = (growth_habit: string) =>
      calculateOptimalSpacing({
        bedDimensions: { width: 4, length: 8 },
        method: 'traditional',
        plants: [{ type: 'tomato', mature_width: 24, growth_habit, quantity: 4 }],
      } as never)

    expect(withHabit('chaotic').layout[0].spacing).toBeCloseTo(
      withHabit('standard').layout[0].spacing,
      5
    )
  })

  test('a real spreading habit still gets more space than compact', () => {
    const withHabit = (growth_habit: string) =>
      calculateOptimalSpacing({
        bedDimensions: { width: 4, length: 8 },
        method: 'traditional',
        plants: [{ type: 'tomato', mature_width: 24, growth_habit, quantity: 4 }],
      } as never)

    expect(withHabit('spreading').layout[0].spacing).toBeGreaterThan(
      withHabit('compact').layout[0].spacing
    )
  })
})
