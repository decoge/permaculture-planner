/**
 * @jest-environment node
 */
import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import { crops } from '@/lib/data/crops'

const requireUser = jest.fn<() => Promise<{ id: string } | null>>()

jest.mock('@/lib/auth/guard', () => ({
  requireUser: () => requireUser(),
}))

const createWizardPlan = jest.fn<(input: unknown) => Promise<{ id: string; siteId: string }>>()

jest.mock('@/lib/db/wizard-plan', () => ({
  createWizardPlan: (input: unknown) => createWizardPlan(input),
}))

function post(body: unknown) {
  return new Request('http://localhost:3000/api/plans', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const VALID = {
  location: { lat: 47.6, lng: -122.3, usda_zone: '8b' },
  area: { total_sqft: 2000, usable_fraction: 0.7, shape: 'rectangular' },
  surface: { type: 'soil', sun_hours: 8, slope: 3, accessibility_needs: false },
  water: { source: 'spigot', drip_allowed: true, sip_interest: false },
  crops: { focus: ['tomato'], time_weekly_minutes: 120 },
  materials: { lumber_type: 'cedar', budget_tier: 'standard' },
}

describe('POST /api/plans input handling', () => {
  beforeEach(() => {
    requireUser.mockReset()
    createWizardPlan.mockReset()
    requireUser.mockResolvedValue({ id: 'user-1' })
    createWizardPlan.mockResolvedValue({ id: 'plan-1', siteId: 'site-1' })
  })

  test('rejects a payload with no area as 400, not a 500', async () => {
    const { POST } = await import('@/app/api/plans/route')

    const { area, ...withoutArea } = VALID
    const response = await POST(post(withoutArea) as never)

    expect(response.status).toBe(400)
    expect(createWizardPlan).not.toHaveBeenCalled()
  })

  test('rejects an out-of-range usable_fraction as 400', async () => {
    const { POST } = await import('@/app/api/plans/route')

    const response = await POST(
      post({ ...VALID, area: { ...VALID.area, usable_fraction: 4 } }) as never
    )

    expect(response.status).toBe(400)
    expect(createWizardPlan).not.toHaveBeenCalled()
  })

  test('rejects a non-numeric total_sqft as 400', async () => {
    const { POST } = await import('@/app/api/plans/route')

    const response = await POST(
      post({ ...VALID, area: { ...VALID.area, total_sqft: 'lots' } }) as never
    )

    expect(response.status).toBe(400)
    expect(createWizardPlan).not.toHaveBeenCalled()
  })

  test('a sub-3-hour site no longer gets full-sun crops recommended', async () => {
    // The route used to map every under-6-hour site to 'partial', and the
    // rotation engine's partial filter includes full-sun crops -- so a one-hour
    // courtyard was handed tomatoes. The shade band must reach the engine, and
    // the saved plantings must be shade-plausible crops.
    const { POST } = await import('@/app/api/plans/route')

    const response = await POST(
      post({ ...VALID, surface: { ...VALID.surface, sun_hours: 1 } }) as never
    )
    expect(response.status).toBe(200)

    const input = createWizardPlan.mock.calls[0][0] as {
      plantings: Array<{ variety: string | null; family: string }>
    }
    expect(input.plantings.length).toBeGreaterThan(0)
    const shadeTolerant = new Set(
      crops.filter((crop) => crop.sun === 'shade' || crop.sun === 'partial').map((crop) => crop.name)
    )
    for (const planting of input.plantings) {
      // The engine's shade filter admits shade and partial crops only. A
      // full-sun crop here (tomato, squash, corn) means the band was lost.
      expect(shadeTolerant).toContain(planting.variety)
    }
  })

  test('every saved bed carries its own plantings, with a name that matches a real bed', async () => {
    const { POST } = await import('@/app/api/plans/route')

    // Large enough that the old flat `slice(0, 10)` dropped whole beds.
    const response = await POST(post(VALID) as never)
    expect(response.status).toBe(200)

    const input = createWizardPlan.mock.calls[0][0] as {
      beds: Array<{ name: string }>
      plantings: Array<{ bedName: string }>
    }

    expect(input.beds.length).toBeGreaterThan(1)

    const bedNames = new Set(input.beds.map((bed) => bed.name))
    // No NaN name: the old `bedId.split('-')` re-derivation produced "Bed NaN"
    // for any id that was not "bed-<number>", which matched no saved bed and so
    // dropped every planting in createWizardPlan.
    for (const name of bedNames) expect(name).not.toMatch(/NaN/)

    // Each bed that got plantings must reference a bed that actually exists.
    const plantedBedNames = new Set(input.plantings.map((p) => p.bedName))
    for (const name of plantedBedNames) expect(bedNames.has(name)).toBe(true)

    // And the cap is per bed, so no single bed is over-represented while others
    // are dropped entirely.
    const counts = input.plantings.reduce<Record<string, number>>((acc, p) => {
      acc[p.bedName] = (acc[p.bedName] ?? 0) + 1
      return acc
    }, {})
    for (const count of Object.values(counts)) expect(count).toBeLessThanOrEqual(3)
    expect(plantedBedNames.size).toBeGreaterThan(1)
  })

  test('an unauthenticated caller is rejected before the payload is examined', async () => {
    requireUser.mockResolvedValue(null)
    const { POST } = await import('@/app/api/plans/route')

    const response = await POST(post({ nonsense: true }) as never)

    expect(response.status).toBe(401)
    expect(createWizardPlan).not.toHaveBeenCalled()
  })
})
