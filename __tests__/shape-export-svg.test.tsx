/**
 * @jest-environment jsdom
 */
/**
 * Export must stay pure SVG.
 *
 * tldraw serialises a shape's on-screen component into the export as
 * <foreignObject> whenever that component uses an HTMLContainer. Chromium taints
 * a canvas that draws an SVG image containing foreignObject, so rasterising the
 * export threw "Tainted canvases may not be exported" and PNG/PDF export
 * produced nothing. Both shapes therefore define `toSvg`; these tests fail if
 * one loses it or if its output starts pulling HTML back in.
 */
import { describe, expect, test } from '@jest/globals'
import { renderToStaticMarkup } from 'react-dom/server'
import { BedShapeUtil, type BedShape } from '@/components/tldraw/shapes/bed-shape'
import { PlantShapeUtil, type PlantShape } from '@/components/tldraw/shapes/plant-shape'

function instance<T>(Util: unknown): T {
  return new (Util as new () => T)()
}

function bedShape(overrides: Partial<BedShape['props']> = {}): BedShape {
  return {
    id: 'shape:bed1',
    type: 'bed',
    x: 0,
    y: 0,
    props: { ...instance<BedShapeUtil>(BedShapeUtil).getDefaultProps(), name: 'Herb Garden', ...overrides },
  } as unknown as BedShape
}

function plantShape(): PlantShape {
  return {
    id: 'shape:plant1',
    type: 'plant',
    x: 10,
    y: 10,
    props: { ...instance<PlantShapeUtil>(PlantShapeUtil).getDefaultProps(), plantName: 'Tomato 🍅' },
  } as unknown as PlantShape
}

describe('shape export rendering', () => {
  test('the bed shape defines its own SVG export', () => {
    expect(typeof BedShapeUtil.prototype.toSvg).toBe('function')
  })

  test('the plant shape defines its own SVG export', () => {
    expect(typeof PlantShapeUtil.prototype.toSvg).toBe('function')
  })

  test('a bed exports as SVG geometry and text, with no HTML wrapper', () => {
    const util = instance<BedShapeUtil>(BedShapeUtil)
    const markup = renderToStaticMarkup(util.toSvg(bedShape()) as React.ReactElement)

    expect(markup).not.toContain('foreignObject')
    expect(markup).toContain('<rect')
    expect(markup).toContain('Herb Garden')
  })

  test('a polygon bed exports its path', () => {
    const util = instance<BedShapeUtil>(BedShapeUtil)
    const markup = renderToStaticMarkup(
      util.toSvg(
        bedShape({
          pointsJson: JSON.stringify([
            { x: 0, y: 0 },
            { x: 60, y: 0 },
            { x: 60, y: 40 },
          ]),
        })
      ) as React.ReactElement
    )

    expect(markup).toContain('<path')
    expect(markup).toContain('Z')
  })

  test('a plant exports its icon and name as text, with no HTML wrapper', () => {
    const util = instance<PlantShapeUtil>(PlantShapeUtil)
    const markup = renderToStaticMarkup(util.toSvg(plantShape()) as React.ReactElement)

    expect(markup).not.toContain('foreignObject')
    expect(markup).toContain('<circle')
    expect(markup).toContain('Tomato')
    expect(markup).toContain('🍅')
  })

  test('a long name is truncated so it cannot run off the shape', () => {
    const util = instance<BedShapeUtil>(BedShapeUtil)
    const markup = renderToStaticMarkup(
      util.toSvg(bedShape({ name: 'A'.repeat(60) })) as React.ReactElement
    )

    expect(markup).toContain('…')
    expect(markup).not.toContain('A'.repeat(40))
  })
})
