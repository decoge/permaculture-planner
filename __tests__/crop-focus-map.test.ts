import { describe, expect, it } from '@jest/globals'
import { expandCropFocus, WIZARD_CROP_FOCUS_CATEGORIES } from '@/lib/data/crop-focus-map'
import { crops } from '@/lib/data/crops'
import { CROP_OPTIONS } from '@/components/wizard/crops-step'

const cropIds = new Set(crops.map((crop) => crop.id))

describe('expandCropFocus', () => {
  it('expands each wizard category to per-crop ids', () => {
    expect(expandCropFocus(['tomatoes'])).toEqual(['tomato', 'pepper', 'eggplant'])
    expect(expandCropFocus(['beans'])).toEqual(['bush_bean', 'pole_bean', 'pea'])
    expect(expandCropFocus(['alliums'])).toEqual(['onion', 'garlic'])
  })

  it('expands a multi-category selection in order, without duplicates', () => {
    // radish is reachable from both brassicas and roots; it must appear once.
    expect(expandCropFocus(['brassicas', 'roots'])).toEqual([
      'broccoli',
      'cabbage',
      'kale',
      'radish',
      'carrot',
      'beet',
      'parsley',
      'celery',
    ])
  })

  it('passes through entries that are already crop ids', () => {
    expect(expandCropFocus(['tomato'])).toEqual(['tomato'])
  })

  it('passes through unrecognized entries rather than dropping them', () => {
    expect(expandCropFocus(['mystery-crop'])).toEqual(['mystery-crop'])
  })

  it('maps every wizard category to at least one real crop id', () => {
    for (const category of WIZARD_CROP_FOCUS_CATEGORIES) {
      const expanded = expandCropFocus([category])
      expect(expanded.length).toBeGreaterThan(0)
      for (const id of expanded) {
        expect(cropIds.has(id)).toBe(true)
      }
    }
  })
})

describe('wizard crop-focus coverage', () => {
  it('covers every id the wizard checkboxes can send', () => {
    for (const option of CROP_OPTIONS) {
      expect(WIZARD_CROP_FOCUS_CATEGORIES).toContain(option.id)
    }
  })

  it('only offers categories the mapping knows how to expand', () => {
    for (const category of WIZARD_CROP_FOCUS_CATEGORIES) {
      expect(CROP_OPTIONS.some((option) => option.id === category)).toBe(true)
    }
  })
})
