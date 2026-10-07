/**
 * Translate the wizard's crop-focus categories into the per-crop ids the
 * rotation engine matches on.
 *
 * The wizard's checkboxes store broad categories ('tomatoes', 'brassicas',
 * 'beans', ...) but `CropRotationEngine` filters with
 * `preferredCrops.includes(c.id)` against the crop database's per-crop ids
 * ('tomato', 'broccoli', 'bush_bean', ...). Passed through unmodified, every
 * selection except 'lettuce' matched nothing and the plan silently ignored the
 * user's crop focus.
 */
export const WIZARD_CROP_FOCUS_CATEGORIES = [
  'tomatoes',
  'lettuce',
  'brassicas',
  'roots',
  'beans',
  'squash',
  'herbs',
  'alliums',
] as const

export type WizardCropFocusCategory = (typeof WIZARD_CROP_FOCUS_CATEGORIES)[number]

const CATEGORY_TO_CROP_IDS: Record<WizardCropFocusCategory, string[]> = {
  tomatoes: ['tomato', 'pepper', 'eggplant'],
  lettuce: ['lettuce', 'mache', 'sorrel'],
  brassicas: ['broccoli', 'cabbage', 'kale', 'radish'],
  roots: ['carrot', 'beet', 'radish', 'parsley', 'celery'],
  beans: ['bush_bean', 'pole_bean', 'pea'],
  squash: ['cucumber', 'zucchini', 'winter_squash'],
  herbs: ['basil', 'parsley'],
  alliums: ['onion', 'garlic'],
}

/**
 * Expand wizard crop-focus categories to per-crop database ids.
 *
 * Entries that are already crop ids (or anything unrecognized) pass through
 * unchanged, so older saved payloads and direct API callers keep working. The
 * result preserves the input's order and de-duplicates.
 */
export function expandCropFocus(focus: string[]): string[] {
  const expanded: string[] = []
  for (const entry of focus) {
    const mapped = (CATEGORY_TO_CROP_IDS as Record<string, string[] | undefined>)[entry]
    if (mapped) {
      for (const id of mapped) {
        if (!expanded.includes(id)) expanded.push(id)
      }
    } else if (!expanded.includes(entry)) {
      expanded.push(entry)
    }
  }
  return expanded
}
