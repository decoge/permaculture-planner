import { describe, expect, test } from '@jest/globals'
import { formatSiteFacts, summarizeSiteFacts } from '@/lib/garden/site-facts'

const gardenPlan = {
  usdaZone: '8b',
  surfaceType: 'soil',
  slopePct: '0.00',
  waterSource: 'spigot',
  constraints: {
    area: { shape: 'rectangular', total_sqft: 100, usable_fraction: 0.8 },
    water: { source: 'spigot', drip_allowed: true, sip_interest: false },
    crops: { focus: [], time_weekly_minutes: 60 },
    materials: {},
  },
  beds: [
    {
      name: 'Salad Greens',
      surface: 'soil',
      height_in: '12.0',
      orientation: 'NS',
      wicking: false,
      trellis: false,
      path_clearance_in: '24.0',
      notes: JSON.stringify({ elementCategory: 'bed' }),
      plantings: [
        { variety: 'lettuce', family: 'Other', season: 'fall', year: 2026 },
        { variety: 'tomato', family: 'Other', season: 'fall', year: 2026 },
        { variety: 'carrot', family: 'Other', season: 'fall', year: 2026 },
      ],
    },
    {
      name: 'Root Vegetables',
      surface: 'soil',
      height_in: 12,
      orientation: 'NS',
      wicking: false,
      trellis: false,
      path_clearance_in: 24,
      plantings: [
        { variety: 'lettuce', family: 'Other', season: 'fall', year: 2026 },
        { variety: 'tomato', family: 'Other', season: 'fall', year: 2026 },
      ],
    },
  ],
  materials: null,
}

describe('summarizeSiteFacts', () => {
  test('reads only the stored site, beds, and plant library', () => {
    const facts = summarizeSiteFacts(gardenPlan)
    const text = formatSiteFacts(facts)

    expect(facts.soil).toEqual(expect.arrayContaining([
      'Site surface is recorded as soil.',
      'Salad Greens surface is recorded as soil.',
      'No soil test is recorded.',
      'From the plant library, Lettuce prefers loamy soil.',
      'From the plant library, Carrot prefers sandy soil.',
      'Soil volume, compost, and mulch are not recorded.',
    ]))
    expect(facts.topography).toEqual(expect.arrayContaining([
      'Slope is recorded as 0%.',
      'Aspect and elevation are not recorded.',
      'Site area is recorded as 100 sq ft.',
      'Site shape is recorded as rectangular.',
      'Usable fraction is recorded as 0.8.',
    ]))
    expect(facts.climate).toEqual(expect.arrayContaining([
      'USDA zone is recorded as 8b.',
      'Last frost and first frost are not recorded.',
      'Latitude and longitude are not recorded.',
      'Shade notes are not recorded.',
      'Rainfall is not recorded.',
      'Listed for USDA zone 8: Lettuce, Tomato, Carrot.',
      'Salad Greens orientation is recorded as NS.',
    ]))
    expect(facts.infrastructure).toEqual(expect.arrayContaining([
      'Water source is recorded as a spigot.',
      'Drip irrigation is recorded as allowed.',
      'Sub-irrigated planters are recorded as not requested.',
      'Drip line length is not recorded.',
      'Weekly garden time is recorded as 60 minutes.',
      'Salad Greens: height 12 in, path clearance 24 in, trellis no, wicking no.',
      'No buildings, fences, or utility lines are saved on this plan.',
    ]))
    expect(facts.biodiversity).toEqual(expect.arrayContaining([
      '5 plantings are saved.',
      '3 species are saved: Lettuce, Tomato, and Carrot.',
      'Saved plant family is recorded as Other.',
      'From the plant library, Lettuce, Tomato, and Carrot are vegetables.',
      'From the plant library, Lettuce and Carrot are companions in Salad Greens.',
      'From the plant library, Tomato and Carrot are companions in Salad Greens.',
      'Wildlife, pollinators, native plants, and habitat corridors are not recorded.',
    ]))
    expect(facts.energy).toEqual(expect.arrayContaining([
      'Energy use is not recorded.',
      'Solar, wind, and thermal mass are not recorded.',
      'Salad Greens orientation is recorded as NS.',
      'No energy systems are saved on this plan.',
    ]))
    expect(facts.community).toEqual(expect.arrayContaining([
      'Community programs, shared plots, volunteers, and teaching areas are not recorded.',
      'Crop focus is not recorded.',
      'Weekly garden time is recorded as 60 minutes. That record does not name a community program.',
    ]))
    expect(facts.economics).toEqual(expect.arrayContaining([
      'No harvests are recorded.',
      'Yields are not recorded.',
      'Prices are not recorded.',
      'Cost is not recorded.',
      'Labor cost is not recorded.',
    ]))
    expect(facts.resilience).toEqual(expect.arrayContaining([
      '3 species are saved: Lettuce, Tomato, and Carrot.',
      'Plantings are recorded for fall 2026.',
      'Water source is recorded as a spigot.',
      'Calories, stored food, and seed saving are not recorded.',
    ]))
    expect(text).not.toContain('organic matter')
    expect(text).not.toContain('swale')
    expect(text).not.toContain('Coming Soon')
    expect(text).not.toContain('$')
    expect(text).not.toContain('kcal')
  })

  test('says when the site has no recorded facts', () => {
    const text = formatSiteFacts(summarizeSiteFacts({}))
    expect(text).toContain('Site surface is not recorded.')
    expect(text).toContain('Slope is not recorded.')
    expect(text).toContain('USDA zone is not recorded.')
    expect(text).toContain('Water source is not recorded.')
    expect(text).toContain('Rainfall is not recorded.')
    expect(text).toContain('Yields are not recorded.')
    expect(text).toContain('Energy use is not recorded.')
    expect(text).toContain('Calories, stored food, and seed saving are not recorded.')
    expect(text).not.toContain('0%')
    expect(text).not.toContain('spigot')
    expect(text).not.toContain('8b')
    expect(text).not.toContain('$')
  })

  test('counts days between saved frost dates and keeps a saved structure', () => {
    const facts = summarizeSiteFacts({
      lastFrost: '2026-04-15',
      firstFrost: '2026-10-15',
      beds: [{ name: 'Shed', elementCategory: 'structure' }],
      materials: { soil_cuft: '12.5', compost_cuft: null, mulch_cuft: 2, drip_line_ft: 40 },
    })
    expect(facts.climate).toEqual(expect.arrayContaining([
      'Last frost is recorded as 2026-04-15.',
      'First frost is recorded as 2026-10-15.',
      'The days between those frost dates are 183.',
    ]))
    expect(facts.infrastructure).toContain('Shed is recorded as a structure.')
    expect(facts.infrastructure).not.toContain('No buildings, fences, or utility lines are saved on this plan.')
    expect(facts.soil).toEqual(expect.arrayContaining([
      'Soil volume is recorded as 12.5 cu ft.',
      'Compost is not recorded.',
      'Mulch is recorded as 2 cu ft.',
    ]))
  })

  test('keeps a saved harvest, cost, energy element, and community name', () => {
    const facts = summarizeSiteFacts({
      constraints: { community: { name: 'Tool library' } },
      beds: [{ name: 'Panel', elementCategory: 'energy' }],
      materials: { cost_estimate_cents: 1250 },
      harvests: [{ variety: 'tomato', quantity: '2', unit: 'lb' }],
    })
    expect(facts.energy).toContain('Panel is recorded as energy.')
    expect(facts.energy).not.toContain('No energy systems are saved on this plan.')
    expect(facts.community).toContain('A community record is saved: Tool library.')
    expect(facts.economics).toEqual(expect.arrayContaining([
      'Tomato harvest is recorded as 2 lb.',
      'Cost is recorded as $12.50.',
    ]))
    expect(facts.economics).not.toContain('Yields are not recorded.')
    expect(facts.resilience).toContain('1 harvest record is saved.')
  })
})
