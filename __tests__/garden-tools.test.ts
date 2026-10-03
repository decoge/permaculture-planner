import { describe, expect, test } from '@jest/globals'
import { formatGardenTools, summarizeGardenTools } from '@/lib/garden/garden-tools'

describe('summarizeGardenTools', () => {
  test('uses saved spacing, sun needs, water source, and season', () => {
    const tools = summarizeGardenTools({
      waterSource: 'spigot',
      constraints: { water: { source: 'spigot', drip_allowed: true } },
      beds: [
        {
          name: 'Salad Greens',
          orientation: 'NS',
          wicking: false,
          plantings: [
            { variety: 'lettuce', spacing_in: '12.0', season: 'fall', year: 2026, target_days_to_maturity: 70 },
            { variety: 'tomato', spacing_in: 12, season: 'fall', year: 2026, target_days_to_maturity: '70' },
            { variety: 'carrot', spacing_in: 12, season: 'fall', year: 2026, target_days_to_maturity: 70 },
          ],
        },
      ],
    })
    const text = formatGardenTools(tools)

    expect(tools.sun).toEqual(expect.arrayContaining([
      'Lettuce in Salad Greens: partial sun from the plant library, spacing recorded as 12 in.',
      'Tomato in Salad Greens: full sun from the plant library, spacing recorded as 12 in.',
      'Full sun: 2. Partial sun: 1. Shade: 0.',
      'The plant library lists 6 in spacing for Lettuce.',
      'The plant library lists 24 in spacing for Tomato.',
      'Shade notes are not recorded.',
      'Latitude and longitude are not recorded, so sunlight hours are not recorded.',
      'Salad Greens orientation is recorded as NS.',
    ]))
    expect(tools.water).toEqual(expect.arrayContaining([
      'Water source is recorded as a spigot.',
      'Drip irrigation is recorded as allowed.',
      'Drip line length is not recorded.',
      'Salad Greens wicking is recorded as no.',
      'From the plant library, Lettuce needs medium water.',
      'Rainfall is not recorded.',
      'Flow rate is not recorded.',
    ]))
    expect(tools.growth).toEqual(expect.arrayContaining([
      'Lettuce in Salad Greens is recorded for fall 2026.',
      'Days to maturity for Tomato in Salad Greens are recorded as 70.',
      'From the plant library, Carrot is planted in Spring and harvested in Summer-Fall.',
      'Last frost and first frost are not recorded.',
      'A growth curve is not calculated.',
    ]))
    expect(text).not.toContain('hours / day')
    expect(text).not.toContain('gallons')
    expect(text).not.toContain('resilient')
  })

  test('says when sun, water, and growth facts are missing', () => {
    const text = formatGardenTools(summarizeGardenTools({}))
    expect(text).toContain('No plants are saved.')
    expect(text).toContain('Latitude and longitude are not recorded, so sunlight hours are not recorded.')
    expect(text).toContain('Water source is not recorded.')
    expect(text).toContain('Flow rate is not recorded.')
    expect(text).toContain('Rainfall is not recorded.')
    expect(text).toContain('Days to maturity are not recorded.')
    expect(text).toContain('A growth curve is not calculated.')
    expect(text).not.toContain('12 in')
    expect(text).not.toContain('spigot')
    expect(text).not.toContain('gallons')
  })
})
