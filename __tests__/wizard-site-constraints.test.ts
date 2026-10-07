import { describe, expect, it } from '@jest/globals'
import { GardenDataTransformer } from '@/lib/garden/garden-types'

const wizardData = {
  name: 'My Garden',
  location: {
    lat: 45.5,
    lng: -122.7,
    usda_zone: '8b',
    last_frost: '2026-04-15',
    first_frost: '2026-10-15',
  },
  area: { total_sqft: 500, usable_fraction: 0.8, shape: 'rectangular' },
  surface: { type: 'soil', sun_hours: 7, slope: 5, accessibility_needs: false },
  water: { source: 'spigot', drip_allowed: true, sip_interest: false },
  crops: { focus: ['tomatoes'], time_weekly_minutes: 60 },
  materials: {},
}

describe('GardenDataTransformer.wizardDataToSite', () => {
  const site = GardenDataTransformer.wizardDataToSite(wizardData as never, 'user-1')

  it('records the wizard sun hours as the shade note', () => {
    // The plan-estimate sun-fit check parses this note ("7 hours sun"); a
    // hardcoded null made every wizard-created plan "sun exposure not recorded".
    expect(site.shade_notes).toBe('7 hours sun')
  })

  it('omits the shade note when sun hours were not answered', () => {
    const { surface, ...withoutSurface } = wizardData
    const partial = GardenDataTransformer.wizardDataToSite(
      { ...withoutSurface } as never,
      'user-1'
    )
    expect(partial.shade_notes).toBeNull()
  })

  it('persists the surface section in constraints_json', () => {
    const constraints = site.constraints_json as Record<string, Record<string, unknown>>
    expect(constraints.surface).toEqual(wizardData.surface)
  })

  it('persists the location section in constraints_json', () => {
    const constraints = site.constraints_json as Record<string, Record<string, unknown>>
    expect(constraints.location).toEqual({
      lat: 45.5,
      lng: -122.7,
      usda_zone: '8b',
      last_frost: '2026-04-15',
      first_frost: '2026-10-15',
    })
  })

  it('keeps the other constraint sections intact', () => {
    const constraints = site.constraints_json as Record<string, unknown>
    expect(constraints.area).toEqual(wizardData.area)
    expect(constraints.water).toEqual(wizardData.water)
    expect(constraints.crops).toEqual(wizardData.crops)
    expect(constraints.materials).toEqual(wizardData.materials)
  })
})
