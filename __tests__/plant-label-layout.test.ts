import { describe, expect, test } from '@jest/globals'
import {
  estimateTextWidth,
  fittedFontSize,
  placePlantsInBed,
  plantMarkBounds,
  plantMarksFit,
} from '@/lib/garden/plant-label-layout'

const saladPlants = [
  { id: 'lettuce', name: 'Lettuce', x: 30, y: 30 },
  { id: 'tomato', name: 'Tomato', x: 42, y: 30 },
  { id: 'carrot', name: 'Carrot', x: 54, y: 30 },
]

describe('placePlantsInBed', () => {
  test('keeps each name and icon inside a narrow bed', () => {
    const placed = placePlantsInBed(saladPlants, 48, 96)
    const names = new Map(saladPlants.map((plant) => [plant.id, plant.name]))
    expect(plantMarksFit(placed, names, 48, 96)).toBe(true)

    placed.forEach((spot) => {
      const box = plantMarkBounds(spot.x, spot.y, names.get(spot.id) || '', spot.radius, spot.fontSize)
      expect(box.top).toBeLessThan(spot.y)
      expect(box.bottom).toBeGreaterThan(spot.y + spot.radius)
    })
  })

  test('uses the same stack when the bed is loaded again', () => {
    const first = placePlantsInBed(saladPlants, 48, 110)
    const reloaded = placePlantsInBed(
      first.map((spot) => ({
        id: spot.id,
        name: saladPlants.find((plant) => plant.id === spot.id)?.name || '',
        x: spot.x,
        y: spot.y,
      })),
      48,
      110,
    )
    expect(reloaded).toEqual(first)
  })

  test('fits Root Vegetables and Salad Greens on one line inside the bed', () => {
    for (const title of ['Root Vegetables', 'Salad Greens']) {
      const size = fittedFontSize(title, 40, 12)
      expect(estimateTextWidth(title, size)).toBeLessThanOrEqual(40.01)
      expect(size).toBeGreaterThan(0)
    }
  })
})
