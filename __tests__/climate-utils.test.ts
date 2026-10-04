import { describe, expect, test } from '@jest/globals'
import {
  deriveClimateFromLocation,
  getClimateDescription,
  getClimateMultipliers,
  getClimateWateringAdvice,
  type ClimateType,
} from '@/lib/climate/climate-utils'

describe('deriveClimateFromLocation', () => {
  test('treats equatorial latitudes as humid', () => {
    expect(deriveClimateFromLocation(0, 0)).toBe('humid')
    expect(deriveClimateFromLocation(22.9, 100)).toBe('humid')
  })

  test('treats temperate latitudes as moderate', () => {
    expect(deriveClimateFromLocation(40, -74)).toBe('moderate')
    expect(deriveClimateFromLocation(49.9, 2)).toBe('moderate')
  })

  test('treats high latitudes as dry', () => {
    expect(deriveClimateFromLocation(60, 0)).toBe('dry')
    expect(deriveClimateFromLocation(-70, 100)).toBe('dry')
  })

  test('is symmetric about the equator', () => {
    // Same latitude either side of the equator must classify identically.
    for (const lat of [0, 22, 30, 45, 60]) {
      expect(deriveClimateFromLocation(lat, 30)).toBe(deriveClimateFromLocation(-lat, 30))
    }
  })

  test('subtropical band splits on longitude into dry and moderate', () => {
    // Continental interior longitude -> dry
    expect(deriveClimateFromLocation(30, 60)).toBe('dry')
    // Far-east / wrap-around longitude -> moderate
    expect(deriveClimateFromLocation(30, 160)).toBe('moderate')
  })
})

describe('climate lookup helpers', () => {
  const climates: ClimateType[] = ['dry', 'humid', 'moderate']

  test('every climate has a non-empty description', () => {
    for (const climate of climates) {
      expect(getClimateDescription(climate).length).toBeGreaterThan(0)
    }
  })

  test('every climate has watering advice', () => {
    for (const climate of climates) {
      expect(getClimateWateringAdvice(climate).length).toBeGreaterThan(0)
    }
  })

  test('dry climates need more water than humid ones', () => {
    const dry = getClimateMultipliers('dry')
    const humid = getClimateMultipliers('humid')
    expect(dry.waterMultiplier).toBeGreaterThan(humid.waterMultiplier)
    expect(dry.evaporationMultiplier).toBeGreaterThan(humid.evaporationMultiplier)
  })

  test('moderate is the neutral baseline', () => {
    const moderate = getClimateMultipliers('moderate')
    expect(moderate.waterMultiplier).toBe(1.0)
    expect(moderate.evaporationMultiplier).toBe(1.0)
    expect(moderate.growthMultiplier).toBe(1.0)
  })
})