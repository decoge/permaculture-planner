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
    expect(text).toContain('No sector map is saved.')
    expect(text).toContain('Wind, fire, wildlife, noise, and views are not recorded.')
    expect(text).toContain('No crop sequence is recorded.')
    expect(text).toContain('A crop rotation is not recorded.')
    expect(text).toContain('Soil volume, compost, mulch, lumber, screws, drip line, emitters, row cover, and cost are not recorded.')
    expect(text).not.toContain('12 in')
    expect(text).not.toContain('spigot')
    expect(text).not.toContain('gallons')
  })

  test('keeps a saved sector note, succession note, and material quantity', () => {
    const tools = summarizeGardenTools({
      slopePct: '0.00',
      constraints: { sectors: 'north wind' },
      beds: [
        {
          name: 'Salad Greens',
          length_ft: '4.00',
          width_ft: '9.17',
          height_in: '12.0',
          orientation: 'NS',
          trellis: false,
          path_clearance_in: '24.0',
          plantings: [
            {
              variety: 'lettuce',
              family: 'Other',
              season: 'fall',
              year: 2026,
              sowing_method: 'direct',
              successions_json: { position: { x: 12, y: 24 }, next: 'beans' },
            },
          ],
        },
      ],
      materials: { soil_cuft: '18.5', lumber_boardfeet: null, cost_estimate_cents: 1250 },
    })

    expect(tools.sectors).toEqual(expect.arrayContaining([
      'A sector record is saved: north wind.',
      'Slope is recorded as 0%.',
      'Salad Greens orientation is recorded as NS.',
    ]))
    expect(tools.succession).toEqual(expect.arrayContaining([
      'Lettuce in Salad Greens is recorded for fall 2026.',
      'Saved plant family for Lettuce in Salad Greens is recorded as Other.',
      'Sowing method for Lettuce in Salad Greens is recorded as direct.',
      'Sow date for Lettuce in Salad Greens is not recorded.',
      'Succession note for Lettuce in Salad Greens: next beans.',
    ]))
    expect(tools.succession).not.toContain('A crop rotation is not recorded.')
    expect(tools.materials).toEqual(expect.arrayContaining([
      'Salad Greens is recorded as 4 ft long, 9.2 ft wide, 12 in tall.',
      'Salad Greens path clearance is recorded as 24 in.',
      'Salad Greens trellis is recorded as no.',
      'Soil volume is recorded as 18.5 cu ft.',
      'Lumber is not recorded.',
      'Cost is recorded as 1250 cents.',
    ]))
  })
})
