/**
 * @jest-environment jsdom
 *
 * Regression guard for the crashiest form of the frost-date bug: the plan page
 * hands this panel `plan.site.first_frost` straight from a pg row, so the prop
 * is a Date while the type used to say string. seasonClock called .split() on it
 * and threw during render, taking the panel and the page's error boundary down.
 *
 * Rendering the real component is the point — a unit test on seasonClock alone
 * would not have caught the prop type lying.
 */
import { describe, expect, jest, test } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import { PlanCalendarPanel } from '@/components/garden/plan-calendar-panel'

const PLANTINGS = [
  {
    id: 'planting-1',
    variety: 'tomato',
    bedName: 'Bed A',
    sow_date: '2026-07-20',
    target_days_to_maturity: 80,
  },
]

describe('PlanCalendarPanel with pg DATE frost props', () => {
  test('renders a season clock when the frost dates arrive as Date objects', () => {
    // Noon on the calendar day, so the assertion does not depend on the runner's
    // timezone: pg builds these at local midnight and toISOString() would move
    // the day east of UTC.
    const current = new Date()
    const firstFrost = new Date(current.getFullYear(), 9, 15, 12)
    const lastFrost = new Date(current.getFullYear(), 3, 15, 12)

    render(
      <PlanCalendarPanel
        plantings={PLANTINGS}
        firstFrost={firstFrost}
        lastFrost={lastFrost}
        materialsEstimate={null}
      />
    )

    // The clock is reported rather than "not recorded", and the planting is
    // listed with its maturity-based state.
    expect(screen.queryByText(/Frost dates are not recorded/i)).toBeNull()
    expect(screen.getByText(/Tomato · Bed A/i)).toBeTruthy()
  })

  test('still says so when the site genuinely has no frost dates', () => {
    render(
      <PlanCalendarPanel plantings={[]} firstFrost={null} lastFrost={null} materialsEstimate={null} />
    )

    expect(screen.getByText(/Frost dates are not recorded/i)).toBeTruthy()
  })
})
