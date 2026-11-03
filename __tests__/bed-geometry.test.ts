import { describe, expect, test } from '@jest/globals'
import { bedAtPoint, boundsContainPoint, placeBedPoints, scalePointsToSize } from '@/lib/garden/bed-geometry'

describe('placeBedPoints', () => {
  const rectangle = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
  ]

  test('moves a normalized polygon to the shape origin', () => {
    expect(placeBedPoints(rectangle, 480, 220, 100, 50)).toEqual([
      { x: 480, y: 220 },
      { x: 580, y: 220 },
      { x: 580, y: 270 },
      { x: 480, y: 270 },
    ])
  })

  test('scales the polygon when the bed box has been resized', () => {
    expect(placeBedPoints(rectangle, 400, 200, 180, 80)).toEqual([
      { x: 400, y: 200 },
      { x: 580, y: 200 },
      { x: 580, y: 280 },
      { x: 400, y: 280 },
    ])
  })

  test('leaves a matching polygon in place', () => {
    const placed = [
      { x: 400, y: 200 },
      { x: 500, y: 200 },
      { x: 500, y: 250 },
      { x: 400, y: 250 },
    ]
    expect(placeBedPoints(placed, 400, 200, 100, 50)).toEqual(placed)
  })

  test('builds a rectangle when the bed has no stored points', () => {
    expect(placeBedPoints([], 10, 20, 30, 40)).toEqual([
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 60 },
      { x: 10, y: 60 },
    ])
  })
})

describe('scalePointsToSize', () => {
  test('rewrites a polygon into the resized box', () => {
    expect(scalePointsToSize([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 0, y: 50 },
    ], 150, 75)).toEqual([
      { x: 0, y: 0 },
      { x: 150, y: 0 },
      { x: 150, y: 75 },
      { x: 0, y: 75 },
    ])
  })
})

describe('boundsContainPoint', () => {
  const bed = { x: 100, y: 100, width: 200, height: 100 }

  test('a point inside the box is inside the bed', () => {
    expect(boundsContainPoint(bed, { x: 150, y: 150 })).toBe(true)
  })

  test('the edges count, matching the conversion that claims plants', () => {
    expect(boundsContainPoint(bed, { x: 100, y: 100 })).toBe(true)
    expect(boundsContainPoint(bed, { x: 300, y: 200 })).toBe(true)
  })

  test('a point beyond any edge is outside', () => {
    expect(boundsContainPoint(bed, { x: 99, y: 150 })).toBe(false)
    expect(boundsContainPoint(bed, { x: 150, y: 201 })).toBe(false)
  })
})

describe('bedAtPoint', () => {
  const beds = [
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 200, y: 0, width: 100, height: 100 },
  ]

  test('returns the bed under the point', () => {
    expect(bedAtPoint(beds, { x: 250, y: 50 })).toEqual(beds[1])
  })

  test('returns null in the gap between beds, which is what the plant tool refuses', () => {
    expect(bedAtPoint(beds, { x: 150, y: 50 })).toBeNull()
  })

  test('returns null for a garden with no beds', () => {
    expect(bedAtPoint([], { x: 10, y: 10 })).toBeNull()
  })
})
