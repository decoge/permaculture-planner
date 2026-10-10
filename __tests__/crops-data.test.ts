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

  // Guards for agent edits: the file is maintained by AI agents, so these pin
  // the field-level contract that the rotation engine and UI rely on. A bad
  // enum or a zero spacing value would otherwise fail silently at runtime.
  const FAMILIES = ['Solanaceae', 'Brassicaceae', 'Cucurbitaceae', 'Fabaceae', 'Allium', 'Apiaceae', 'Asteraceae', 'Amaranthaceae', 'Polygonaceae', 'Poaceae', 'Other']
  const SUNS = ['full', 'partial', 'shade']
  const SEASONS = ['spring', 'summer', 'fall', 'winter']
  const WATER = ['low', 'medium', 'high']

  test('every crop carries valid enums and positive numbers', () => {
    for (const crop of crops) {
      expect(FAMILIES).toContain(crop.family)
      expect(SUNS).toContain(crop.sun)
      expect(WATER).toContain(crop.water_needs)
      expect(crop.seasons.length).toBeGreaterThan(0)
      for (const season of crop.seasons) {
        expect(SEASONS).toContain(season)
      }
      expect(crop.spacing_in).toBeGreaterThan(0)
      expect(crop.days_to_maturity).toBeGreaterThan(0)
      expect(crop.name.length).toBeGreaterThan(0)
    }
  })

  test('ids are lowercase and word-separated, so key-safe', () => {
    // snake_case and kebab-case both occur ('winter_squash', 'bush_bean' style
    // naming in the plant library); the contract is only that ids are
    // lowercase alphanumeric with single separator characters.
    for (const crop of crops) {
      expect(crop.id).toMatch(/^[a-z0-9]+([_-][a-z0-9]+)*$/)
    }
  })
})
