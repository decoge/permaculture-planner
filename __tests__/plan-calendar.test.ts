import { describe, expect, it } from '@jest/globals'
import { harvestReadiness, seasonClock, type ReadinessInput } from '@/lib/garden/plan-calendar'
import { shoppingListFromEstimate } from '@/lib/garden/shopping-list'

const TODAY = '2026-10-08'

function readiness(overrides: Partial<ReadinessInput>): ReadinessInput {
  return { plantingId: 'p1', label: 'Tomato', sowDate: null, daysToMaturity: null, ...overrides }
}

describe('harvestReadiness', () => {
  it('reports ready-now when the window opened today', () => {
    // 80 days before today.
    const rows = [readiness({ sowDate: '2026-07-20', daysToMaturity: 80 })]
    const result = harvestReadiness(rows, TODAY)
    expect(result[0].state).toBe('ready')
    expect(result[0].note).toBe('Ready now.')
  })

  it('reports growing with days remaining', () => {
    const result = harvestReadiness(
      [readiness({ sowDate: '2026-10-01', daysToMaturity: 30 })],
      TODAY
    )
    expect(result[0].state).toBe('growing')
    expect(result[0].daysUntilReady).toBe(23)
    expect(result[0].note).toContain('23 days')
  })

  it('reports growing until the window opens', () => {
    const result = harvestReadiness(
      [readiness({ sowDate: '2026-09-15', daysToMaturity: 30 })], // ready 10-15, 7 days out
      TODAY
    )
    expect(result[0].state).toBe('growing')
    expect(result[0].readyFrom).toBe('2026-10-15')
  })

  it('marks overdue after the 30-day hold window', () => {
    const result = harvestReadiness(
      [readiness({ sowDate: '2026-05-01', daysToMaturity: 60 })], // ready 06-30
      TODAY
    )
    expect(result[0].state).toBe('overdue')
    expect(result[0].daysUntilReady).toBe(-100)
  })

  it('still ready inside the hold window', () => {
    const result = harvestReadiness(
      [readiness({ sowDate: '2026-07-25', daysToMaturity: 60 })], // ready 09-23, 15 days ago
      TODAY
    )
    expect(result[0].state).toBe('ready')
  })

  it('reports missing sow dates and unknown crops honestly', () => {
    const result = harvestReadiness(
      [readiness({ plantingId: 'a', label: 'A' }), readiness({ plantingId: 'b', label: 'B', sowDate: '2026-08-01' })],
      TODAY
    )
    expect(result[0].state).toBe('not-recorded')
    expect(result[1].state).toBe('unknown-crop')
  })

  it('crosses year boundaries correctly', () => {
    const result = harvestReadiness(
      [readiness({ sowDate: '2025-12-20', daysToMaturity: 30 })], // ready 2026-01-19
      TODAY
    )
    expect(result[0].state).toBe('overdue')
    expect(result[0].readyFrom).toBe('2026-01-19')
  })
})

describe('seasonClock', () => {
  it('mid-season: after last frost, before first frost', () => {
    // First frost 10-15, last frost 04-15, today 10-08.
    const clock = seasonClock('2026-10-15', '2026-04-15', '2026-10-08')
    expect(clock.inGrowingSeason).toBe(true)
    expect(clock.daysUntilFirstFrost).toBe(7)
    expect(clock.daysSinceLastFrost).toBe(176)
    expect(clock.note).toContain('7 days until first frost')
  })

  it('after first frost: off-season, counting to the next last frost', () => {
    const clock = seasonClock('2026-10-15', '2026-04-15', '2026-11-01')
    expect(clock.inGrowingSeason).toBe(false)
    // Next last frost is 2027-04-15: 165 days out.
    expect(clock.daysUntilLastFrost).toBe(165)
    expect(clock.note).toContain('last frost in 165 days')
  })

  it('before last frost counts down to it', () => {
    const clock = seasonClock('2026-10-15', '2026-04-15', '2026-03-01')
    expect(clock.inGrowingSeason).toBe(false)
    expect(clock.daysUntilLastFrost).toBe(45)
    expect(clock.note).toContain('last frost in 45 days')
  })

  it('maps MM-DD averages onto the next occurrence from any month', () => {
    // Today is January; the recorded first frost (10-15) is next October.
    const clock = seasonClock('10-15', '04-15', '2027-01-10')
    expect(clock.daysUntilFirstFrost).toBe(278) // 2027-10-15
    expect(clock.inGrowingSeason).toBe(false)
    // Next last frost (04-15) is closer, so it defines the message.
    expect(clock.note).toContain('last frost in 95 days')
  })

  it('reports not-recorded when nothing is known', () => {
    const clock = seasonClock(null, null, TODAY)
    expect(clock.inGrowingSeason).toBeNull()
    expect(clock.note).toContain('not recorded')
  })

  it('handles only one frost date being recorded', () => {
    const clock = seasonClock('2026-10-15', null, '2026-10-08')
    expect(clock.daysUntilFirstFrost).toBe(7)
    expect(clock.daysSinceLastFrost).toBeNull()
    expect(clock.inGrowingSeason).toBeNull()
  })
})

describe('shoppingListFromEstimate', () => {
  it('emits bags for small volumes and bulk for large', () => {
    const items = shoppingListFromEstimate({
      soil_cuft: 4,
      compost_cuft: 60,
      mulch_cuft: null,
    })
    expect(items).toContain('2 bags (2 cu ft) raised bed soil')
    expect(items).toContain('2.2 cubic yards compost (bulk delivery)')
    expect(items).toHaveLength(2)
  })

  it('passes through hardware counts verbatim', () => {
    const items = shoppingListFromEstimate({
      lumber_boardfeet: 128,
      screws_count: 96,
      drip_line_ft: 100,
      emitters_count: 20,
      row_cover_sqft: 64,
    })
    expect(items).toContain('128 board-feet lumber for bed frames')
    expect(items).toContain('Cut to plan: check bed lengths before buying')
    expect(items).toContain('96 exterior wood screws (2.5")')
    expect(items).toContain('100 ft — 1/4" drip line')
    expect(items).toContain('20 drip emitters (0.5 GPH)')
    expect(items).toContain('64 sq ft — floating row cover')
  })

  it('returns nothing for null or all-null estimates', () => {
    expect(shoppingListFromEstimate(null)).toEqual([])
    expect(shoppingListFromEstimate({})).toEqual([])
  })
})
