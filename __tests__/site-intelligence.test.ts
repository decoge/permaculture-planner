/**
 * @jest-environment node
 */
import { describe, expect, test } from '@jest/globals'
import { SiteIntelligenceService } from '@/lib/services/site-intelligence'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function dayOfYear(monthDay: string): number {
  const [month, day] = monthDay.split(' ')
  return MONTHS.indexOf(month) * 31 + Number(day)
}

const service = SiteIntelligenceService.getInstance()

describe('site intelligence frost modelling', () => {
  test('a southern-hemisphere site gets frost dates in local order', async () => {
    const sydney = await service.getSiteIntelligence(-33.9, 151.2, 'Sydney')

    // In the southern hemisphere the frost-free season runs Oct -> Apr, i.e.
    // it wraps the new year. Naive date ordering must not be assumed.
    const last = dayOfYear(sydney.climate.frost.last_frost)
    const first = dayOfYear(sydney.climate.frost.first_frost)

    expect(last).toBeGreaterThan(first)
  })

  test('a northern-hemisphere site gets frost dates in local order', async () => {
    const portland = await service.getSiteIntelligence(45.5, -122.7, 'Portland')

    const last = dayOfYear(portland.climate.frost.last_frost)
    const first = dayOfYear(portland.climate.frost.first_frost)

    expect(last).toBeLessThan(first)
  })

  test('tropical sites are not told to expect frost', async () => {
    // The equator sits on the boundary between the two hemisphere branches and
    // is not frost-prone; it must not be modelled as austral.
    const singapore = await service.getSiteIntelligence(1.35, 103.8, 'Singapore')
    const last = dayOfYear(singapore.climate.frost.last_frost)
    const first = dayOfYear(singapore.climate.frost.first_frost)

    expect(last).toBeLessThan(first)
    expect(singapore.climate.hardiness_zone).toBe('Zone 10')
  })

  test('frost_free_days stays within a plausible range at every latitude', async () => {
    const lats = [0, 10, 25, 45, 60, 89, -45, -89]

    for (const lat of lats) {
      const site = await service.getSiteIntelligence(lat, 0)
      const { frost_free_days: days } = site.climate.frost

      expect(days).toBeGreaterThan(0)
      expect(days).toBeLessThanOrEqual(365)
      // A tropical site should not be reported as having a short season.
      if (Math.abs(lat) < 15) expect(days).toBeGreaterThan(300)
    }
  })

  test('the equator is not treated as austral', async () => {
    // lat > 0 is the branch condition, so lat === 0 falls to the southern
    // dates (Oct -> Apr) while the season length formula treats it as
    // frost-free year-round. The two fields then contradict each other.
    const equator = await service.getSiteIntelligence(0, 0, 'Equator')

    const last = dayOfYear(equator.climate.frost.last_frost)
    const first = dayOfYear(equator.climate.frost.first_frost)

    // Equatorial sites are Zone 10 and frost-free; they should read as
    // northern-style (Apr -> Oct) rather than claiming an Oct -> Apr window.
    expect(equator.climate.hardiness_zone).toBe('Zone 10')
    expect(equator.climate.frost.frost_free_days).toBeGreaterThan(300)
    expect(last).toBeLessThan(first)
  })

  test('colder latitudes report shorter frost-free seasons', async () => {
    const cold = await service.getSiteIntelligence(60, 0)
    const mild = await service.getSiteIntelligence(30, 0)

    expect(cold.climate.frost.frost_free_days).toBeLessThan(
      mild.climate.frost.frost_free_days
    )
    // And the cold site should pick up cold-season advice.
    expect(cold.recommendations.structures.join(' ')).toMatch(/greenhouse|cold frame/i)
  })

  test('generated estimates stay physically plausible', async () => {
    for (const lat of [0, 45, 70]) {
      const site = await service.getSiteIntelligence(lat, 0)
      const { annual_avg, summer_high, winter_low } = site.climate.temperature

      expect(summer_high).toBeGreaterThan(winter_low)
      expect(site.climate.humidity.annual_avg).toBeLessThanOrEqual(100)
      expect(site.climate.humidity.annual_avg).toBeGreaterThan(0)
      expect(site.soil.ph.value).toBeGreaterThanOrEqual(0)
      expect(site.soil.ph.value).toBeLessThanOrEqual(14)
      expect(site.terrain.slope.percentage).toBeGreaterThanOrEqual(0)
      expect(site.terrain.slope.percentage).toBeLessThanOrEqual(100)
    }
  })
})