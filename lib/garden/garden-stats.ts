import type { GardenBed } from '@/lib/garden/garden-types'

export interface GardenItemCounts {
  beds: number
  plants: number
  elements: number
}

/**
 * Count what the canvas holds, for the editor's status line.
 *
 * A bed's `elementCategory` is optional, and on a plan loaded straight from the
 * store (or from the starter demo garden) it is absent. Counting "not a bed" as
 * an element therefore reported both starter beds as elements until the first
 * canvas edit wrote `elementCategory: 'bed'` into them — the same garden read
 * "2 beds • 2 elements" before an edit and "2 beds • 0 elements" after.
 */
export function countGardenItems(beds: GardenBed[]): GardenItemCounts {
  let bedCount = 0
  let plantCount = 0
  let elementCount = 0

  for (const bed of beds) {
    const category = bed.elementCategory
    if (category && category !== 'bed') elementCount += 1
    else bedCount += 1

    plantCount += bed.plants?.length ?? 0
  }

  return { beds: bedCount, plants: plantCount, elements: elementCount }
}
