/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, test, jest } from '@jest/globals'
import {
  canvasBounds,
  canvasToJson,
  canvasToJsonText,
  canvasToSvg,
  exportCanvas,
} from '@/lib/export/canvas-exporter'
import type { GardenBed } from '@/lib/garden/garden-types'

function bed(overrides: Partial<GardenBed> = {}): GardenBed {
  return {
    id: 'bed-1',
    name: 'Bed 1',
    points: [
      { x: 0, y: 0 },
      { x: 96, y: 0 },
      { x: 96, y: 48 },
      { x: 0, y: 48 },
    ],
    fill: '#e0f2e0',
    stroke: '#22c55e',
    plants: [],
    ...overrides,
  }
}

describe('canvasBounds', () => {
  test('covers every bed', () => {
    const bounds = canvasBounds([
      bed({ points: [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 68 }, { x: 10, y: 68 }] }),
      bed({ id: 'bed-2', points: [{ x: 200, y: 300 }, { x: 300, y: 300 }, { x: 300, y: 400 }, { x: 200, y: 400 }] }),
    ])

    expect(bounds.minX).toBe(10)
    expect(bounds.maxX).toBe(300)
    expect(bounds.minY).toBe(20)
    expect(bounds.maxY).toBe(400)
    expect(bounds.width).toBe(290)
    expect(bounds.height).toBe(380)
  })

  test('includes plants that sit outside their bed', () => {
    const bounds = canvasBounds([
      bed({
        plants: [{ id: 'p1', plantId: 'tomato', x: 500, y: 500 }],
      }),
    ])

    // A plant placed off its bed must still be inside the exported drawing.
    expect(bounds.maxX).toBe(500)
    expect(bounds.maxY).toBe(500)
  })

  test('returns usable dimensions for an empty canvas rather than NaN', () => {
    const bounds = canvasBounds([])
    expect(Number.isFinite(bounds.width)).toBe(true)
    expect(Number.isFinite(bounds.height)).toBe(true)
    expect(bounds.width).toBeGreaterThan(0)
    expect(bounds.height).toBeGreaterThan(0)
  })

  test('handles beds with no points', () => {
    const bounds = canvasBounds([bed({ points: [] })])
    expect(Number.isFinite(bounds.width)).toBe(true)
  })
})

describe('canvasToSvg', () => {
  test('produces a well-formed standalone SVG', () => {
    const svg = canvasToSvg([bed()], { padding: 10 })

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    // Every tag opened must be balanced.
    expect((svg.match(/<svg/g) || []).length).toBe(1)
    expect((svg.match(/<\/svg>/g) || []).length).toBe(1)
  })

  test('draws each bed as a polygon from its points', () => {
    const svg = canvasToSvg([bed(), bed({ id: 'bed-2', name: 'Bed 2' })], { padding: 0 })
    expect((svg.match(/<polygon/g) || []).length).toBe(2)
  })

  test('draws a circle per plant', () => {
    const svg = canvasToSvg([
      bed({
        plants: [
          { id: 'p1', plantId: 'tomato', x: 20, y: 20 },
          { id: 'p2', plantId: 'carrot', x: 40, y: 40 },
        ],
      }),
    ])
    expect((svg.match(/<circle/g) || []).length).toBe(2)
  })

  test('shifts a canvas away from the origin into view', () => {
    // Without the shift every coordinate would be negative and off-canvas.
    const svg = canvasToSvg(
      [bed({ points: [{ x: -500, y: -400 }, { x: -400, y: -400 }, { x: -400, y: -300 }, { x: -500, y: -300 }] })],
      { padding: 20 }
    )
    const polygon = /points="([^"]+)"/.exec(svg)
    expect(polygon).not.toBeNull()
    for (const pair of polygon![1].split(' ')) {
      const [x, y] = pair.split(',').map(Number)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(y).toBeGreaterThanOrEqual(0)
    }
  })

  test('escapes XML in names so a bed name cannot break the document', () => {
    const svg = canvasToSvg([bed({ name: '<script>alert("x")</script>' })])
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })

  test('never emits a NaN coordinate', () => {
    const svg = canvasToSvg([bed(), bed({ id: 'b2', plants: [{ id: 'p', plantId: 'x', x: 77, y: 88 }] })])
    expect(svg).not.toContain('NaN')
  })

  test('renders an empty canvas without throwing', () => {
    const svg = canvasToSvg([])
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).not.toContain('NaN')
  })

  test('omits the legend when asked', () => {
    const withLegend = canvasToSvg([bed()], { showLegend: true })
    const without = canvasToSvg([bed()], { showLegend: false })
    expect(withLegend.length).toBeGreaterThan(without.length)
  })

  test('includes the title when supplied', () => {
    expect(canvasToSvg([bed()], { title: 'My Plan' })).toContain('My Plan')
  })
})

describe('canvasToJson', () => {
  test('round-trips the beds', () => {
    const beds = [bed(), bed({ id: 'bed-2', name: 'Bed 2' })]
    const parsed = JSON.parse(canvasToJsonText(beds, 'Plan A'))

    expect(parsed.beds).toHaveLength(2)
    expect(parsed.beds[0].name).toBe('Bed 1')
    expect(parsed.title).toBe('Plan A')
    expect(typeof parsed.exportedAt).toBe('string')
  })

  test('produces an application/json blob of the same content', () => {
    const blob = canvasToJson([bed()], 'Plan')
    expect(blob.type).toBe('application/json')
  })
})

describe('exportCanvas', () => {
  /**
   * Capture the anchor while it is in the DOM. The exporter removes it right
   * after clicking, so asserting on document.querySelector afterwards finds
   * nothing -- which is itself the behaviour one test checks.
   */
  function captureAnchor() {
    const captured: { download: string | null; href: string }[] = []
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        captured.push({ download: this.getAttribute('download'), href: this.getAttribute('href') ?? '' })
      })
    return captured
  }

  beforeEach(() => {
    // jsdom has no object URL implementation.
    globalThis.URL.createObjectURL = jest.fn(() => 'blob:mock') as never
    globalThis.URL.revokeObjectURL = jest.fn() as never
  })

  test('downloads an SVG blob for svg format', async () => {
    const captured = captureAnchor()

    await exportCanvas([bed()], 'svg', { title: 'Plan' })

    expect(globalThis.URL.createObjectURL).toHaveBeenCalled()
    expect(captured).toHaveLength(1)
    expect(captured[0].download).toBe('Plan.svg')
  })

  test('downloads JSON with the right extension', async () => {
    const captured = captureAnchor()

    await exportCanvas([bed()], 'json', { title: 'My Plan' })

    // Spaces become dashes in a download filename.
    expect(captured[0].download).toBe('My-Plan.json')
  })

  test('preserves the extension separator in a title', async () => {
    const captured = captureAnchor()

    await exportCanvas([bed()], 'json', { title: 'plan.v2' })

    // The extension must not be stripped along with the dots.
    expect(captured[0].download).toBe('plan-v2.json')
  })

  test('falls back to a fixed name when a title has nothing usable', async () => {
    const captured = captureAnchor()

    await exportCanvas([bed()], 'json', { title: '///' })

    expect(captured[0].download).toBe('garden-plan.json')
  })

  test('sanitises the filename so a title cannot steer the download path', async () => {
    const captured = captureAnchor()

    await exportCanvas([bed()], 'json', { title: '../../etc/passwd' })

    const name = captured[0].download ?? ''
    expect(name).not.toContain('/')
    expect(name).not.toContain('..')
  })

  test('removes the anchor from the DOM after clicking', async () => {
    captureAnchor()

    await exportCanvas([bed()], 'json')

    // A stray anchor would accumulate one per export.
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })

  test('revokes the object URL so it does not leak', async () => {
    captureAnchor()

    await exportCanvas([bed()], 'json')

    // Revocation is deferred by a tick so the click has been dispatched first;
    // without the deferral the download can be cancelled before it starts.
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
