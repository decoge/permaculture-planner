import { describe, expect, test } from '@jest/globals'
import { PLANT_LIBRARY } from '@/lib/data/plant-library'

describe('the plant library sun bands', () => {
  test('the shade band is populated', () => {
    // A `shade` requirement that no plant uses is dead data: the sun-fit check
    // could never recommend anything for a low-light site. These four woodland
    // crops genuinely produce in 0-3 hours of sun.
    const shade = PLANT_LIBRARY.filter((plant) => plant.requirements.sun === 'shade')
    expect(shade.map((plant) => plant.id).sort()).toEqual(['hosta', 'mache', 'ostrich fern', 'sorrel'])
  })

  test('every companion and antagonist id resolves', () => {
    // A dangling companion reference silently drops out of
    // getCompanionPlants, so a typo here is invisible until someone notices a
    // missing suggestion.
    const ids = new Set(PLANT_LIBRARY.map((plant) => plant.id))
    for (const plant of PLANT_LIBRARY) {
      for (const ref of [...plant.companions, ...plant.antagonists]) {
        expect(ids.has(ref)).toBe(true)
      }
    }
  })

  test('every entry has the fields the panels read', () => {
    for (const plant of PLANT_LIBRARY) {
      expect(plant.icon.length).toBeGreaterThan(0)
      expect(plant.size.spacing).toBeGreaterThan(0)
      expect(plant.size.mature_width).toBeGreaterThan(0)
      expect(plant.requirements.zone.length).toBeGreaterThan(0)
      expect(plant.harvest_time.length).toBeGreaterThan(0)
    }
  })
})
