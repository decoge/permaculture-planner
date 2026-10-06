import { describe, expect, test } from '@jest/globals'
import { crops } from '@/lib/data/crops'

describe('the crops database', () => {
  test('the shade band is populated', () => {
    // filterCropsBySun('shade') returned nothing when no crop carried the
    // band, so every bed at a sub-3-hour site produced "No suitable crops".
    const shade = crops.filter((crop) => crop.sun === 'shade')
    expect(shade.length).toBeGreaterThan(0)
  })

  test('shade crops have seasons, so the engine can actually place them', () => {
    // A shade entry with an empty seasons list would still fail selectCropsForBed.
    for (const crop of crops.filter((crop) => crop.sun === 'shade')) {
      expect(crop.seasons.length).toBeGreaterThan(0)
      expect(crop.spacing_in).toBeGreaterThan(0)
      expect(crop.days_to_maturity).toBeGreaterThan(0)
    }
  })

  test('every companion and antagonist reference resolves', () => {
    const ids = new Set(crops.map((crop) => crop.id))
    for (const crop of crops) {
      for (const ref of [...(crop.companion_plants ?? []), ...(crop.antagonistic_plants ?? [])]) {
        expect(ids.has(ref)).toBe(true)
      }
    }
  })

  test('ids are unique', () => {
    const ids = crops.map((crop) => crop.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
