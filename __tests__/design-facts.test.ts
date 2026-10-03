import { describe, expect, test } from '@jest/globals'
import { formatDesignFacts, summarizeDesignFacts } from '@/lib/garden/design-facts'

describe('summarizeDesignFacts', () => {
  test('uses saved plants, area, and time without inventing companions or yields', () => {
    const facts = summarizeDesignFacts({
      usdaZone: '8b',
      waterSource: 'spigot',
      constraints: {
        area: { total_sqft: 100, usable_fraction: 0.8 },
        crops: { time_weekly_minutes: 60 },
      },
      beds: [
        {
          name: 'Salad Greens',
          length_ft: '4.00',
          width_ft: '9.17',
          plantings: [
            { variety: 'lettuce', season: 'fall', year: 2026 },
            { variety: 'tomato', season: 'fall', year: 2026, notes: 'watch for aphids' },
          ],
        },
        {
          name: 'Root Vegetables',
          length_ft: 4,
          width_ft: 6.83,
          plantings: [{ variety: 'carrot', season: 'fall', year: 2026 }],
        },
      ],
    })
    const text = formatDesignFacts(facts)

    expect(facts.companions).toContain('Salad Greens has Lettuce and Tomato saved in the same bed.')
    expect(facts.companions).toContain('No companion pair from the plant library is recorded for Salad Greens.')
    expect(facts.companions).toContain('No companion pairs from the plant library share a bed.')
    expect(facts.relationships).toContain('No link between Salad Greens and Root Vegetables is recorded.')
    expect(facts.relationships).toContain('Guilds, energy flows, and nutrient cycles are not recorded.')
    expect(facts.evolution).toContain('Lettuce in Salad Greens is recorded for fall 2026.')
    expect(facts.evolution).toContain('Yields are not recorded.')
    expect(facts.evolution).toContain('Milestones are not recorded.')
    expect(facts.implementation).toContain('Weekly garden time is recorded as 60 minutes.')
    expect(facts.implementation).toContain('Implementation phases are not recorded.')
    expect(facts.implementation).toContain('A phase schedule is not recorded.')
    expect(facts.critique).toContain('A design score is not recorded.')
    expect(facts.critique).toContain('Last frost is not recorded.')
    expect(facts.progress).toContain('No journal entries are recorded.')
    expect(facts.progress).toContain('No harvests are recorded.')
    expect(facts.progress).toContain('No tasks are recorded.')
    expect(facts.knowledge).toContain('Tomato in Salad Greens note: watch for aphids')
    expect(facts.templates).toContain('No template is saved on this plan.')
    expect(facts.analytics).toContain('Site area is recorded as 100 sq ft.')
    expect(facts.analytics).toContain('Usable fraction is recorded as 0.8.')
    expect(facts.analytics).toContain('Salad Greens is recorded as 4 ft by 9.2 ft.')
    expect(facts.analytics).toContain('Yields are not recorded.')
    expect(facts.permaculture).toContain('USDA zone is recorded as 8b.')
    expect(facts.permaculture).toContain('Water source is recorded as a spigot.')
    expect(facts.permaculture).toContain('A permaculture principle score is not recorded.')
    expect(text).not.toContain('basil')
    expect(text).not.toContain('pounds')
    expect(text).not.toContain('Apr 15')
    expect(text).not.toContain('Phase 1')
  })

  test('says when the plan has no saved design facts', () => {
    const text = formatDesignFacts(summarizeDesignFacts({}))
    expect(text).toContain('No companion pairs from the plant library share a bed.')
    expect(text).toContain('Guilds, energy flows, and nutrient cycles are not recorded.')
    expect(text).toContain('A multi-year timeline is not recorded.')
    expect(text).toContain('Implementation phases are not recorded.')
    expect(text).toContain('A design score is not recorded.')
    expect(text).toContain('No journal entries are recorded.')
    expect(text).toContain('Knowledge notes are not recorded.')
    expect(text).toContain('No template is saved on this plan.')
    expect(text).toContain('Site area is not recorded.')
    expect(text).toContain('Yields are not recorded.')
    expect(text).toContain('A permaculture principle score is not recorded.')
    expect(text).not.toContain('basil')
    expect(text).not.toContain('100')
  })

  test('keeps a saved template, journal entry, and harvest', () => {
    const facts = summarizeDesignFacts({
      template: 'kitchen garden',
      journal: [{ title: 'First sowing', content: 'Direct sowed lettuce.', created_at: '2026-09-01', images: [] }],
      harvests: [{ variety: 'lettuce', quantity: 2, unit: 'lb', harvested_on: '2026-11-01' }],
      tasks: [{ title: 'Water', due_on: '2026-10-10', completed: false }],
    })
    expect(facts.templates).toContain('A template is saved: kitchen garden.')
    expect(facts.progress).toContain('First sowing is recorded on 2026-09-01.')
    expect(facts.progress).toContain('Direct sowed lettuce.')
    expect(facts.progress).toContain('Lettuce harvest is recorded as 2 lb on 2026-11-01.')
    expect(facts.progress).toContain('1 task is recorded.')
    expect(facts.progress).not.toContain('Yields are not recorded.')
    expect(facts.knowledge).toContain('First sowing: Direct sowed lettuce.')
  })

  test('uses plant-library companion pairs saved in the same bed', () => {
    const facts = summarizeDesignFacts({
      beds: [
        {
          name: 'Salad Greens',
          plantings: [
            { variety: 'lettuce' },
            { variety: 'tomato' },
            { variety: 'carrot' },
          ],
        },
        {
          name: 'Root Vegetables',
          plantings: [
            { variety: 'lettuce' },
            { variety: 'tomato' },
          ],
        },
      ],
    })

    expect(facts.companions).toContain('From the plant library, Lettuce with Carrot in Salad Greens.')
    expect(facts.companions).toContain('From the plant library, Tomato with Carrot in Salad Greens.')
    expect(facts.companions).toContain('No companion pair from the plant library is recorded for Root Vegetables.')
    expect(facts.companions).not.toContain('A companion relationship is not recorded for Salad Greens.')
    expect(facts.companions).not.toContain('Companion lists are not recorded.')
    expect(facts.companions.join(' ')).not.toContain('basil')
  })
})
