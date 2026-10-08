/**
 * @jest-environment node
 *
 * Integrity test: every plant id the wizard can store must resolve in
 * PLANT_LIBRARY. An id that misses the library renders as "unknown" in the
 * facts panels and silently falls back to default water/yield estimates --
 * the same hand-written-list drift the crops-step categories had.
 *
 * CROP_CATEGORY_PLANT_IDS is imported from the service itself, so this test
 * checks the list the code actually uses rather than a copy of it.
 */
import { describe, expect, it } from '@jest/globals'
import { PLANT_LIBRARY } from '@/lib/data/plant-library'
import { CROP_CATEGORY_PLANT_IDS } from '@/lib/wizard/wizard-service'

describe('wizard plant options exist in the plant library', () => {
  it('every hard-coded plant id resolves', () => {
    const missing: string[] = []
    for (const [category, ids] of Object.entries(CROP_CATEGORY_PLANT_IDS)) {
      for (const id of ids) {
        if (!PLANT_LIBRARY.some((entry) => entry.id === id)) {
          missing.push(`${category}/${id}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('every category offers at least three plants', () => {
    for (const ids of Object.values(CROP_CATEGORY_PLANT_IDS)) {
      expect(ids.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('no id appears twice within a category', () => {
    for (const [category, ids] of Object.entries(CROP_CATEGORY_PLANT_IDS)) {
      expect(new Set(ids).size).toBe(ids.length)
      void category
    }
  })
})
