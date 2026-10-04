import { describe, expect, test } from '@jest/globals'
import { analyzeCompanionPlanting } from '@/lib/algorithms/companion-planting-engine'
import type { GardenBed } from '@/lib/garden/garden-types'

function planted(plantId: string, x: number, y: number) {
  return { id: `${plantId}-${x}-${y}`, plantId, x, y }
}

function bed(plants: ReturnType<typeof planted>[], overrides: Partial<GardenBed> = {}): GardenBed {
  return {
    id: 'bed-1',
    name: 'Test Bed',
    points: [],
    fill: '#000',
    stroke: '#000',
    plants,
    ...overrides,
  }
}

describe('analyzeCompanionPlanting', () => {
  test('flags antagonistic plants planted too close as an error', () => {
    // tomato antagonizes cabbage; 10in apart is well inside the 24in error threshold
    const analysis = analyzeCompanionPlanting([
      bed([planted('tomato', 0, 0), planted('cabbage', 10, 0)]),
    ])

    expect(analysis.stats.totalPairs).toBe(1)
    expect(analysis.stats.badPairs).toBe(1)
    expect(analysis.relationships[0].relationship).toBe('bad')

    const error = analysis.warnings.find(w => w.severity === 'error')
    expect(error).toBeDefined()
    expect(error?.message).toMatch(/antagonistic/i)
  })

  test('does not warn when antagonistic plants are far enough apart', () => {
    // 48in apart is the documented separation threshold
    const analysis = analyzeCompanionPlanting([
      bed([planted('tomato', 0, 0), planted('cabbage', 48, 0)]),
    ])

    expect(analysis.stats.badPairs).toBe(1)
    expect(analysis.warnings).toHaveLength(0)
  })

  test('warns but does not error for antagonistic plants at medium distance', () => {
    const analysis = analyzeCompanionPlanting([
      bed([planted('tomato', 0, 0), planted('cabbage', 36, 0)]),
    ])

    expect(analysis.warnings).toHaveLength(1)
    expect(analysis.warnings[0].severity).toBe('warning')
  })

  test('counts every unordered pair exactly once', () => {
    const analysis = analyzeCompanionPlanting([
      bed([
        planted('tomato', 10, 10),
        planted('lettuce', 20, 10),
        planted('carrot', 30, 10),
        planted('basil', 40, 10),
      ]),
    ])

    // 4 plants -> 6 unordered pairs, not 12
    expect(analysis.stats.totalPairs).toBe(6)
    expect(
      analysis.stats.goodPairs + analysis.stats.neutralPairs + analysis.stats.badPairs
    ).toBe(analysis.stats.totalPairs)
  })

  test('scores a bed with no plant pairs as 100', () => {
    const analysis = analyzeCompanionPlanting([bed([planted('tomato', 0, 0)])])
    expect(analysis.stats.totalPairs).toBe(0)
    expect(analysis.score).toBe(100)
  })

  test('penalises antagonistic plantings below a perfect score', () => {
    const bad = analyzeCompanionPlanting([
      bed([planted('tomato', 0, 0), planted('cabbage', 10, 0)]),
    ])
    expect(bad.score).toBeLessThan(100)
    expect(bad.score).toBeGreaterThanOrEqual(0)
  })

  test('suggests adding missing companions', () => {
    const analysis = analyzeCompanionPlanting([bed([planted('tomato', 0, 0)])])
    const addCompanion = analysis.recommendations.find(r => r.type === 'add_companion')

    expect(addCompanion).toBeDefined()
    expect(addCompanion?.plantId).toBe('tomato')
    expect(addCompanion?.suggestedCompanions?.length).toBeGreaterThan(0)
  })

  test('ignores beds with fewer than two plants', () => {
    const analysis = analyzeCompanionPlanting([bed([]), bed([planted('tomato', 0, 0)])])
    expect(analysis.relationships).toHaveLength(0)
    expect(analysis.score).toBe(100)
  })
})