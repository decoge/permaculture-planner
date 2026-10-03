import { describe, expect, test } from '@jest/globals'
import { placePlantsInBed, plantMarkBounds } from '@/lib/garden/plant-label-layout'

const saladPlants = [
  { id: 'lettuce', name: 'Lettuce', x: 30, y: 30 },
  { id: 'tomato', name: 'Tomato', x: 42, y: 30 },
  { id: 'carrot', name: 'Carrot', x: 54, y: 30 },
]

function boxesOverlap(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

describe('placePlantsInBed', () => {
  test('separates cramped wizard plants so names clear the icons', () => {
    const placed = placePlantsInBed(saladPlants, 48, 96)
    const boxes = placed.map((spot) => {
      const plant = saladPlants.find((item) => item.id === spot.id)
      return plantMarkBounds(spot.x, spot.y, plant?.name || '', spot.radius)
    })

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(boxesOverlap(boxes[i], boxes[j])).toBe(false)
      }
    }

    placed.forEach((spot, index) => {
      const plant = saladPlants.find((item) => item.id === spot.id)
      const box = boxes[index]
      expect(box.left).toBeLessThan(spot.x)
      expect(box.right).toBeGreaterThan(spot.x + spot.radius)
      expect(plant?.name.length).toBeGreaterThan(0)
    })
  })

  test('keeps the same stack after the bed size is unchanged', () => {
    const first = placePlantsInBed(saladPlants, 48, 96)
    const reloaded = placePlantsInBed(
      first.map((spot) => {
        const plant = saladPlants.find((item) => item.id === spot.id)
        return { id: spot.id, name: plant?.name || '', x: spot.x, y: spot.y }
      }),
      48,
      96,
    )
    expect(reloaded.map((spot) => ({ id: spot.id, x: spot.x, y: spot.y }))).toEqual(
      first.map((spot) => ({ id: spot.id, x: spot.x, y: spot.y })),
    )
  })

  test('repacks when a shorter bed would make the old stack collide', () => {
    const tall = placePlantsInBed(saladPlants, 48, 96)
    const short = placePlantsInBed(
      tall.map((spot) => {
        const plant = saladPlants.find((item) => item.id === spot.id)
        return { id: spot.id, name: plant?.name || '', x: spot.x, y: spot.y }
      }),
      48,
      52,
    )
    const boxes = short.map((spot) => {
      const plant = saladPlants.find((item) => item.id === spot.id)
      return plantMarkBounds(spot.x, spot.y, plant?.name || '', spot.radius)
    })
    expect(boxesOverlap(boxes[0], boxes[1])).toBe(false)
    expect(boxesOverlap(boxes[1], boxes[2])).toBe(false)
  })
})
