/**
 * Shopping list derived from a *stored* materials estimate.
 *
 * The full MaterialsEstimate structure is only computed in memory at save
 * time; the database persists ten summary columns. This function builds the
 * list from those columns and says so — quantities that cannot be split from
 * a summary (like lumber board-feet into individual boards) are reported as
 * the summary figure with a note, never invented.
 */

export interface StoredEstimate {
  soil_cuft?: number | null
  compost_cuft?: number | null
  mulch_cuft?: number | null
  lumber_boardfeet?: number | null
  screws_count?: number | null
  drip_line_ft?: number | null
  emitters_count?: number | null
  row_cover_sqft?: number | null
}

const CUFT_PER_BULK_YARD = 27
const CUFT_PER_BAG = 2

function formatQuantity(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** Bulk delivery above a yard; bags below it — the standard split. */
function soilLikeItem(label: string, cuft: number | null | undefined, out: string[]): void {
  if (typeof cuft !== 'number' || !Number.isFinite(cuft) || cuft <= 0) return
  const yards = cuft / CUFT_PER_BULK_YARD
  if (yards > 1) {
    out.push(`${formatQuantity(yards)} cubic yards ${label} (bulk delivery)`)
  } else {
    out.push(`${Math.ceil(cuft / CUFT_PER_BAG)} bags (2 cu ft) ${label}`)
  }
}

export function shoppingListFromEstimate(estimate: StoredEstimate | null | undefined): string[] {
  const items: string[] = []
  if (!estimate) return items

  soilLikeItem('raised bed soil', estimate.soil_cuft, items)
  soilLikeItem('compost', estimate.compost_cuft, items)
  soilLikeItem('wood mulch', estimate.mulch_cuft, items)

  if (typeof estimate.lumber_boardfeet === 'number' && estimate.lumber_boardfeet > 0) {
    items.push(`${formatQuantity(estimate.lumber_boardfeet)} board-feet lumber for bed frames`)
    items.push('Cut to plan: check bed lengths before buying')
  }
  if (typeof estimate.screws_count === 'number' && estimate.screws_count > 0) {
    items.push(`${formatQuantity(estimate.screws_count)} exterior wood screws (2.5")`)
  }
  if (typeof estimate.drip_line_ft === 'number' && estimate.drip_line_ft > 0) {
    items.push(`${formatQuantity(estimate.drip_line_ft)} ft — 1/4" drip line`)
  }
  if (typeof estimate.emitters_count === 'number' && estimate.emitters_count > 0) {
    items.push(`${formatQuantity(estimate.emitters_count)} drip emitters (0.5 GPH)`)
  }
  if (typeof estimate.row_cover_sqft === 'number' && estimate.row_cover_sqft > 0) {
    items.push(`${formatQuantity(estimate.row_cover_sqft)} sq ft — floating row cover`)
  }

  return items
}
