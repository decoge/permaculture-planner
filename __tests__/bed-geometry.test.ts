import { describe, expect, test } from '@jest/globals'
import { placeBedPoints, scalePointsToSize } from '@/lib/garden/bed-geometry'

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
