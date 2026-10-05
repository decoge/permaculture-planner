import { describe, expect, test } from '@jest/globals'
import { analyzeDesign, getCategoryIcon, getSeverityColor } from '@/lib/analysis/design-critique'
import { PLANT_LIBRARY } from '@/lib/data/plant-library'
import type { GardenBed, PlantedItem } from '@/lib/garden/garden-types'

function plant(plantId: string): PlantedItem {
  return { id: `p-${plantId}-${Math.random()}`, plantId, x: 0, y: 0 }
}

/** Bed sized 48x96in = 32 sq ft, so 4/sqft = 128 plants is the threshold. */
function bed(plants: PlantedItem[], overrides: Partial<GardenBed> = {}): GardenBed {
  return {
    id: 'b1',
    name: 'Bed 1',
    points: [
      { x: 0, y: 0 },
      { x: 48, y: 0 },
      { x: 48, y: 96 },
      { x: 0, y: 96 },
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants,
    width: 48,
    height: 96,
    ...overrides,
  }
}

function byCategory(category: string): string {
  const found = PLANT_LIBRARY.find((p) => p.category === category)
  if (!found) throw new Error(`no library plant in category ${category}`)
  return found.id
}

describe('analyzeDesign recognises perennials by library category', () => {
  test('a tree is counted as a perennial', () => {
    // The old check listed 'fruit_trees' as a perennial, which is not a plant id.
    const tree = byCategory('tree')
    const critique = analyzeDesign([
      bed([
        plant(tree),
        plant(tree),
        plant(byCategory('vegetable')),
        plant(byCategory('vegetable')),
        plant(byCategory('vegetable')),
      ]),
    ])

    const perennialIssue = critique.issues.find((i) => i.title === 'All Annual Plants')
    // 2 of 5 plants are a tree, so this must not claim the design is all annual.
    expect(perennialIssue).toBeUndefined()
  })

  test('a perennial-heavy design is reported as a strength', () => {
    const critique = analyzeDesign([
      bed([
        plant(byCategory('tree')),
        plant(byCategory('tree')),
        plant(byCategory('shrub')),
        plant(byCategory('fruit')),
        plant(byCategory('vegetable')),
      ]),
    ])

    expect(critique.strengths.join(' ')).toMatch(/perennial/i)
  })

  test('a genuinely all-annual design is still flagged', () => {
    const veg = byCategory('vegetable')
    const critique = analyzeDesign([
      bed(Array.from({ length: 12 }, () => plant(veg))),
    ])

    expect(critique.issues.map((i) => i.title)).toContain('All Annual Plants')
  })
})

describe('analyzeDesign nitrogen fixer count', () => {
  test('counts the legumes that are actually in the library', () => {
    const critique = analyzeDesign([
      bed([
        plant('beans'),
        plant('peas'),
        plant('clover'),
        plant(byCategory('vegetable')),
        plant(byCategory('vegetable')),
        plant(byCategory('vegetable')),
      ]),
    ])

    // 'alfalfa' was in the old list but is not a plant id, so it never matched.
    expect(critique.strengths.join(' ')).toMatch(/nitrogen fixers \(3 plants\)/)
  })

  test('flags a large design with no legumes', () => {
    const veg = byCategory('vegetable')
    const critique = analyzeDesign([bed(Array.from({ length: 8 }, () => plant(veg)))])

    expect(critique.issues.map((i) => i.title)).toContain('No Nitrogen Fixers')
  })
})

describe('analyzeDesign names the beds that are actually overcrowded', () => {
  test('reports the crowded bed itself, not the first N beds', () => {
    // 200 plants in 32 sq ft is ~6/sqft, over the threshold of 4.
    const crowded = Array.from({ length: 200 }, (_, i) => plant(`tomato-${i}`))
    const critique = analyzeDesign([
      bed([plant('basil')], { id: 'b1', name: 'Quiet bed one' }),
      bed([plant('basil')], { id: 'b2', name: 'Quiet bed two' }),
      bed(crowded, { id: 'b3', name: 'Crowded bed' }),
    ])

    const spacing = critique.issues.find((i) => i.title === 'Overcrowding Detected')
    expect(spacing).toBeDefined()
    // The old code reported the first N beds by index, so this would have named
    // the two quiet beds and never mentioned the crowded one.
    expect(spacing!.affectedElements).toEqual(['Crowded bed'])
  })

  test('names every crowded bed when several are', () => {
    const crowded = Array.from({ length: 200 }, (_, i) => plant(`tomato-${i}`))
    const critique = analyzeDesign([
      bed(crowded, { id: 'b1', name: 'First' }),
      bed([plant('basil')], { id: 'b2', name: 'Fine' }),
      bed(crowded, { id: 'b3', name: 'Third' }),
    ])

    const spacing = critique.issues.find((i) => i.title === 'Overcrowding Detected')
    expect(spacing!.affectedElements).toEqual(['First', 'Third'])
    expect(spacing!.description).toContain('2 bed(s)')
  })

  test('a comfortably planted bed raises no spacing issue', () => {
    const critique = analyzeDesign([bed(Array.from({ length: 10 }, () => plant('basil')))])

    expect(critique.issues.map((i) => i.title)).not.toContain('Overcrowding Detected')
  })
})

describe('analyzeDesign score stays in range', () => {
  test('is between 0 and 100 for an empty design', () => {
    const critique = analyzeDesign([])
    expect(critique.overallScore).toBeGreaterThanOrEqual(0)
    expect(critique.overallScore).toBeLessThanOrEqual(100)
  })

  test('is between 0 and 100 for a heavily flawed design', () => {
    const veg = byCategory('vegetable')
    const critique = analyzeDesign([
      bed(Array.from({ length: 400 }, (_, i) => plant(`${veg}-${i}`)), { id: 'b1', name: 'A' }),
      bed(Array.from({ length: 400 }, (_, i) => plant(`${veg}-b-${i}`)), { id: 'b2', name: 'B' }),
    ])
    expect(critique.overallScore).toBeGreaterThanOrEqual(0)
    expect(critique.overallScore).toBeLessThanOrEqual(100)
  })

  test('always offers at least one quick win', () => {
    expect(analyzeDesign([]).quickWins.length).toBeGreaterThan(0)
    expect(analyzeDesign([bed([plant('tomato')])]).quickWins.length).toBeGreaterThan(0)
  })
})

describe('presentation helpers cover every case', () => {
  test('every severity has a colour class', () => {
    for (const severity of ['critical', 'warning', 'suggestion'] as const) {
      expect(getSeverityColor(severity)).toMatch(/text-/)
    }
  })

  test('every issue category has an icon', () => {
    for (const category of [
      'spacing',
      'companion',
      'water',
      'sun',
      'succession',
      'biodiversity',
      'efficiency',
    ] as const) {
      expect(getCategoryIcon(category).length).toBeGreaterThan(0)
    }
  })
})
