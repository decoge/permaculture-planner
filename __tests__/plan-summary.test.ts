import { describe, expect, test } from '@jest/globals'
import { formatPlanSummary, summarizePlan } from '@/lib/garden/plan-summary'

describe('summarizePlan', () => {
  test('reads sun, spacing, and companions from the saved plants', () => {
    const summary = summarizePlan([
      {
        name: 'Salad Greens',
        length_ft: '4',
        width_ft: '8',
        plantings: [
          { variety: 'lettuce', successions_json: { position: { x: 10, y: 10 } } },
          { variety: 'tomato', successions_json: { position: { x: 20, y: 10 } } },
          { variety: 'carrot', successions_json: JSON.stringify({ position: { x: 40, y: 40 } }) },
        ],
      },
    ])

    expect(summary.bedCount).toBe(1)
    expect(summary.areaSqFt).toBe(32)
    expect(summary.species).toEqual(['Lettuce', 'Tomato', 'Carrot'])
    expect(summary.sunCounts).toEqual({ full: 2, partial: 1, shade: 0, unknown: 0 })
    expect(summary.beds[0].plants.map((plant) => plant.spacingIn)).toEqual([6, 24, 3])

    const tomatoAndLettuce = summary.spacingNotes.find(
      (note) => note.plantA === 'Lettuce' && note.plantB === 'Tomato',
    )
    expect(tomatoAndLettuce).toMatchObject({
      apartIn: 10,
      neededIn: 24,
      closerThanNeeded: true,
    })

    expect(summary.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({ plantA: 'Lettuce', plantB: 'Carrot', relation: 'companion' }),
      expect.objectContaining({ plantA: 'Tomato', plantB: 'Carrot', relation: 'companion' }),
    ]))
    expect(summary.relationships.some((note) => note.relation === 'antagonist')).toBe(false)
    expect(summary).not.toHaveProperty('overall')

    const text = formatPlanSummary({
      planName: 'Garden Plan',
      siteName: 'Home garden',
      usdaZone: '7b',
      summary,
    })
    expect(text).toContain('Tomato')
    expect(text).toContain('full sun')
    expect(text).toContain('partial sun')
    expect(text).not.toContain('out of 100')
    expect(text).not.toContain('Organic Matter')
  })

  test('uses canvas plant positions when the bed is stored in pixels', () => {
    const summary = summarizePlan([
      {
        name: 'Root Vegetables',
        width: 48,
        height: 24,
        plants: [
          { plantId: 'carrot', x: 12, y: 12 },
          { name: 'mystery herb' },
        ],
      },
    ])

    expect(summary.beds[0]).toMatchObject({ lengthFt: 4, widthFt: 2 })
    expect(summary.beds[0].plants[1]).toMatchObject({
      name: 'Mystery Herb',
      sun: null,
      spacingIn: null,
    })
    expect(summary.sunCounts.unknown).toBe(1)
    expect(summary.spacingNotes).toEqual([])
  })
})
