import { describe, expect, test } from '@jest/globals'
import { PLANT_LIBRARY, checkCompatibility } from '@/lib/data/plant-library'

describe('plant library referential integrity', () => {
  test('every companion and antagonist id resolves to a real plant', () => {
    const ids = new Set(PLANT_LIBRARY.map((p) => p.id))
    const dangling: string[] = []

    for (const plant of PLANT_LIBRARY) {
      for (const other of [...plant.companions, ...plant.antagonists]) {
        if (!ids.has(other)) dangling.push(`${plant.id} -> ${other}`)
      }
    }

    expect(dangling).toEqual([])
  })

  test('no plant lists itself as a companion or antagonist', () => {
    const selfRefs = PLANT_LIBRARY.filter(
      (p) => p.companions.includes(p.id) || p.antagonists.includes(p.id)
    ).map((p) => p.id)

    expect(selfRefs).toEqual([])
  })

  test('no plant is both a companion and an antagonist of another', () => {
    const conflicts: string[] = []

    for (const plant of PLANT_LIBRARY) {
      const overlap = plant.companions.filter((c) => plant.antagonists.includes(c))
      if (overlap.length > 0) conflicts.push(`${plant.id}: ${overlap.join(', ')}`)
    }

    expect(conflicts).toEqual([])
  })

  test('plant ids are unique', () => {
    const seen = new Set<string>()
    const dupes: string[] = []

    for (const plant of PLANT_LIBRARY) {
      if (seen.has(plant.id)) dupes.push(plant.id)
      seen.add(plant.id)
    }

    expect(dupes).toEqual([])
  })
})

describe('checkCompatibility honours declared relationships', () => {
  test('a declared antagonist is reported as bad, not neutral', () => {
    // Tomato lists cabbage as an antagonist; a missing counterpart used to
    // collapse this to 'neutral'.
    expect(checkCompatibility('tomato', 'cabbage')).toBe('bad')
  })

  test('a declared companion is reported as good', () => {
    expect(checkCompatibility('tomato', 'basil')).toBe('good')
  })

  test('relationship is symmetric regardless of argument order', () => {
    expect(checkCompatibility('cabbage', 'tomato')).toBe(checkCompatibility('tomato', 'cabbage'))
  })

  test('an unrelated pair is neutral', () => {
    expect(checkCompatibility('tomato', 'lettuce')).toBe('neutral')
  })

  test('unknown ids are neutral rather than throwing', () => {
    expect(checkCompatibility('tomato', 'not-a-real-plant')).toBe('neutral')
  })
})