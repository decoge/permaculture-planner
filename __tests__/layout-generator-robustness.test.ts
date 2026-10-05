import { describe, expect, test } from '@jest/globals'
import { LayoutGenerator, type SiteConstraints } from '@/lib/algorithms/layout-generator'

function constraints(overrides: Partial<SiteConstraints> = {}): SiteConstraints {
  return {
    totalArea: 500,
    usableFraction: 0.8,
    shape: 'rectangular',
    surface: 'soil',
    waterAccess: 'spigot',
    sunExposure: 'full',
    slope: 2,
    ...overrides,
  }
}

describe('LayoutGenerator.generate is total over its inputs', () => {
  // Every number below is a division by usableArea somewhere in generate():
  // areaLength = usableArea / areaWidth and efficiency = totalBedArea /
  // usableArea. A zero or negative area made those Infinity or NaN.
  test.each([
    ['zero area', { totalArea: 0 }],
    ['zero usable fraction', { usableFraction: 0 }],
    ['both zero', { totalArea: 0, usableFraction: 0 }],
    ['negative area', { totalArea: -100 }],
    ['negative fraction', { usableFraction: -0.5 }],
  ])('returns finite numbers for %s', (_label, overrides) => {
    const layout = new LayoutGenerator().generate(constraints(overrides))

    expect(layout.beds).toEqual([])
    expect(Number.isFinite(layout.totalBedArea)).toBe(true)
    expect(Number.isFinite(layout.totalPathArea)).toBe(true)
    expect(Number.isFinite(layout.efficiency)).toBe(true)
    expect(layout.efficiency).toBe(0)
  })

  test('warns rather than returning a silently empty layout', () => {
    const layout = new LayoutGenerator().generate(constraints({ totalArea: 0 }))
    expect(layout.warnings.join(' ')).toMatch(/usable area/i)
  })

  test('treats a non-finite area as zero instead of propagating NaN', () => {
    const layout = new LayoutGenerator().generate(
      constraints({ totalArea: Number.NaN, usableFraction: 0.8 })
    )
    expect(Number.isFinite(layout.efficiency)).toBe(true)
    expect(layout.efficiency).toBe(0)
  })

  test('clamps a usable fraction above 1 rather than inflating the area', () => {
    const over = new LayoutGenerator().generate(constraints({ totalArea: 500, usableFraction: 4 }))
    const atOne = new LayoutGenerator().generate(constraints({ totalArea: 500, usableFraction: 1 }))

    expect(over.beds.length).toBe(atOne.beds.length)
    expect(over.totalBedArea).toBeCloseTo(atOne.totalBedArea, 5)
  })

  test('a normal site still lays out beds and keeps efficiency in (0, 1]', () => {
    const layout = new LayoutGenerator().generate(constraints())

    expect(layout.beds.length).toBeGreaterThan(0)
    expect(layout.efficiency).toBeGreaterThan(0)
    expect(layout.efficiency).toBeLessThanOrEqual(1)
    expect(Number.isFinite(layout.efficiency)).toBe(true)
  })

  test('every generated bed has positive dimensions', () => {
    const layout = new LayoutGenerator().generate(constraints())

    for (const bed of layout.beds) {
      expect(bed.width).toBeGreaterThan(0)
      expect(bed.length).toBeGreaterThan(0)
      expect(Number.isFinite(bed.x)).toBe(true)
      expect(Number.isFinite(bed.y)).toBe(true)
    }
  })

  test('bed area never exceeds the usable area it was laid out in', () => {
    for (const area of [10, 50, 200, 1000, 5000]) {
      const c = constraints({ totalArea: area })
      const layout = new LayoutGenerator().generate(c)
      const usable = area * c.usableFraction
      expect(layout.totalBedArea).toBeLessThanOrEqual(usable)
    }
  })

  test('a tiny site produces no beds rather than a negative or fractional one', () => {
    const layout = new LayoutGenerator().generate(
      constraints({ totalArea: 1, usableFraction: 0.1 })
    )
    expect(layout.beds).toEqual([])
    expect(layout.totalBedArea).toBe(0)
  })
})