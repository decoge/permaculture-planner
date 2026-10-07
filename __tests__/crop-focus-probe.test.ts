/* eslint-disable */
// Temporary probe: proves the old passthrough dropped the user's crop focus.
import { describe, expect, it } from '@jest/globals'
import { CropRotationEngine } from '@/lib/algorithms/crop-rotation'
import { expandCropFocus } from '@/lib/data/crop-focus-map'

const beds = [
  { id: 'bed-0', name: 'Bed 1', x: 0, y: 0, width: 4, length: 8, height: 12, orientation: 'NS' as const, hasTrellis: false, isWicking: false, pathWidth: 24 },
]

describe('probe: crop focus reachability', () => {
  it('old passthrough ignored the tomatoes selection; expansion honors it', () => {
    const engine = new CropRotationEngine()
    const layout = engine.generateRotation({
      beds,
      startSeason: 'summer',
      startYear: 2026,
      seasonsToplan: 1,
      sunExposure: 'full',
    })

    // Old behavior: 'tomatoes' matches no crop id, so plantings equal the
    // no-preference baseline exactly.
    const withOldPassthrough = new CropRotationEngine().generateRotation({
      beds,
      startSeason: 'summer',
      startYear: 2026,
      seasonsToplan: 1,
      sunExposure: 'full',
      preferredCrops: ['tomatoes'],
    })
    expect(withOldPassthrough.plantings.map((p) => p.crops.map((c) => c.id).sort())).toEqual(
      layout.plantings.map((p) => p.crops.map((c) => c.id).sort())
    )

    // New behavior: 'tomatoes' expands to tomato/pepper/eggplant, so the
    // solanaceae crop appears in the plan.
    const withExpansion = new CropRotationEngine().generateRotation({
      beds,
      startSeason: 'summer',
      startYear: 2026,
      seasonsToplan: 1,
      sunExposure: 'full',
      preferredCrops: expandCropFocus(['tomatoes']),
    })
    const plannedIds = withExpansion.plantings.flatMap((p) => p.crops.map((c) => c.id))
    expect(plannedIds).toContain('tomato')
  })
})
