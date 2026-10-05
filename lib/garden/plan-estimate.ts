/**
 * Plan estimation: water, yield and value.
 *
 * These three calculations used to live in an orphaned `lib/calculations/`
 * module and an equally orphaned `lib/data/plant-yield-data.ts`. Neither had an
 * importer, so the app had no water estimate, no yield projection and no ROI
 * anywhere -- the facts panels reported "Yields are not recorded" and stopped.
 *
 * The data here is live: PLANT_YIELD_DATABASE in lib/data/plant-yield-data.ts
 * carries USDA / university-extension figures for 30 plants, and
 * PLANT_LIBRARY carries the per-plant water need, sun requirement and spacing
 * for all 50. This module turns those into the numbers a gardener actually
 * needs, and lives beside the facts engine that renders them.
 *
 * Every lookup falls back rather than producing NaN: a plant missing from the
 * yield database is estimated from its category instead, and a bed with no
 * recorded geometry contributes zero rather than poisoning a total.
 */
import { PLANT_LIBRARY, type PlantInfo } from '@/lib/data/plant-library'
import { PLANT_YIELD_DATABASE } from '@/lib/data/plant-yield-data'

/** Gallons per plant per week, by the library's water requirement. */
const WATER_BY_NEED: Record<PlantInfo['requirements']['water'], number> = {
  low: 0.5,
  medium: 1.0,
  high: 1.75,
}

/**
 * Fallback yield in pounds per plant, for plants absent from the yield
 * database. Ordered from most to least productive so the first match wins.
 */
const YIELD_BY_CATEGORY: Record<PlantInfo['category'], { amount: number; price: number }> = {
  tree: { amount: 40, price: 2.0 },
  fruit: { amount: 8, price: 4.0 },
  shrub: { amount: 5, price: 5.0 },
  vine: { amount: 6, price: 3.0 },
  vegetable: { amount: 2, price: 2.5 },
  herb: { amount: 0.5, price: 8.0 },
  flower: { amount: 0.3, price: 3.0 },
  groundcover: { amount: 0.2, price: 2.0 },
}

export interface PlantEstimateInput {
  plantId?: unknown
  variety?: unknown
  name?: unknown
}

export interface WaterEstimate {
  /** Gallons per week for this plant. */
  gallonsPerWeek: number
  /** Which source supplied the figure. */
  source: 'database' | 'library' | 'category'
  label: string
}

export interface YieldEstimate {
  plantId: string
  label: string
  /** Plants of this kind in the plan. */
  count: number
  /** Expected pounds per plant per year. */
  poundsPerPlant: number
  /** count * poundsPerPlant. */
  totalPounds: number
  /** Retail replacement value of totalPounds. */
  value: number
  source: 'database' | 'category'
}

export interface PlanEstimate {
  water: {
    gallonsPerWeek: number
    /** Same figure expressed per day, which is how it is usually quoted. */
    gallonsPerDay: number
    /** Cost at a nominal $0.004/gal municipal water, or null if unpriced. */
    weeklyCost: number | null
    peakGallonsPerWeek: number
    byPlant: Array<{ plantId: string; label: string; gallonsPerWeek: number; source: string }>
    notes: string[]
  }
  yield: {
    totalPounds: number
    lowPounds: number
    highPounds: number
    /** Retail replacement value of totalPounds. */
    totalValue: number
    /** Distinct plant kinds, the practical ceiling on diversity. */
    varieties: number
    byPlant: YieldEstimate[]
  }
  /** Value against the recorded build cost, when a cost was saved. */
  roi: {
    setupCost: number | null
    annualValue: number
    /** annualValue - setupCost, or null when no cost is recorded. */
    firstYearNet: number | null
    /** Years for value to exceed the setup cost at this annual figure. */
    breakEvenYears: number | null
  }
  /** 0-100, from how much of the plan is estimable and how well it scores. */
  score: number
  strengths: string[]
  cautions: string[]
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function number(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function libraryEntry(plantId: string): PlantInfo | null {
  return PLANT_LIBRARY.find((entry) => entry.id === plantId) || null
}

/**
 * Resolve a plant from whatever identifying fields the caller supplied.
 *
 * The canvas stores `plantId`; the database stores `variety`; a hand-entered
 * plan may carry only a display name. Try each in turn rather than requiring
 * the canonical id.
 */
export function resolvePlant(input: PlantEstimateInput): PlantInfo | null {
  const id = text(input.plantId)
  if (id) {
    const byId = libraryEntry(id)
    if (byId) return byId
  }
  const variety = text(input.variety)
  if (variety) {
    const byVariety = PLANT_LIBRARY.find(
      (entry) => entry.id === variety.toLowerCase() || entry.name.toLowerCase() === variety.toLowerCase()
    )
    if (byVariety) return byVariety
  }
  const name = text(input.name)
  if (name) {
    const needle = name.toLowerCase()
    const byName = PLANT_LIBRARY.find((entry) => entry.name.toLowerCase() === needle)
    if (byName) return byName
  }
  return null
}

function labelFor(plant: PlantInfo | null, input: PlantEstimateInput): string {
  return plant?.name || text(input.name) || text(input.variety) || text(input.plantId) || 'Unknown plant'
}

/**
 * Weekly water need for one plant.
 *
 * Prefers the measured figure in the yield database, then the library's
 * low/medium/high requirement, and only then a category average. The three
 * sources disagree -- the database is per-crop measured, the library is a
 * coarse requirement band -- so the source is reported with the number.
 */
export function estimateWaterFor(plant: PlantInfo | null, input: PlantEstimateInput): WaterEstimate {
  const id = plant?.id || text(input.plantId) || text(input.variety) || ''
  const label = labelFor(plant, input)
  const measured = PLANT_YIELD_DATABASE[id]

  if (measured && Number.isFinite(measured.waterPerWeek?.base)) {
    return {
      gallonsPerWeek: measured.waterPerWeek.base,
      source: 'database',
      label,
    }
  }

  if (plant) {
    const banded = WATER_BY_NEED[plant.requirements.water]
    if (Number.isFinite(banded)) {
      return { gallonsPerWeek: banded, source: 'library', label }
    }
  }

  const fallback = plant ? YIELD_BY_CATEGORY[plant.category] : null
  return {
    gallonsPerWeek: fallback ? WATER_BY_NEED.medium : 1.0,
    source: fallback ? 'category' : 'library',
    label,
  }
}

/**
 * Yield and value for one plant kind.
 *
 * `count` is how many of that kind are in the plan; the database figure is per
 * plant, so the total is the product. The low/high band is the database's own
 * min/max where present, otherwise a +/-25% band around the estimate.
 */
export function estimateYieldFor(
  plant: PlantInfo | null,
  input: PlantEstimateInput,
  count: number
): YieldEstimate {
  const id = plant?.id || text(input.plantId) || text(input.variety) || ''
  const label = labelFor(plant, input)
  const measured = PLANT_YIELD_DATABASE[id]
  const fallback = plant ? YIELD_BY_CATEGORY[plant.category] : null
  const poundsPerPlant = measured?.yieldPerPlant?.average ?? fallback?.amount ?? 1
  const price = measured?.marketPrice ?? fallback?.price ?? 2
  const safeCount = Number.isFinite(count) && count > 0 ? count : 0

  return {
    plantId: id,
    label,
    count: safeCount,
    poundsPerPlant,
    totalPounds: poundsPerPlant * safeCount,
    value: poundsPerPlant * safeCount * price,
    source: measured?.yieldPerPlant?.average !== undefined ? 'database' : 'category',
  }
}

/** Cost per gallon used for the money figure. */
const WATER_PRICE_PER_GALLON = 0.004

/**
 * Estimate water, yield and return for a whole plan.
 *
 * `plants` is the flat list of every planting across every bed -- the caller
 * aggregates, so this stays independent of how beds are stored. `setupCostCents`
 * is the recorded build cost when one was saved, which is what makes an ROI
 * figure possible at all.
 */
export function estimatePlan(
  plants: PlantEstimateInput[],
  setupCostCents?: unknown
): PlanEstimate {
  const list = Array.isArray(plants) ? plants : []

  // Group by resolved library entry so a bed of twelve tomatoes counts once as
  // twelve plants rather than as twelve unrelated kinds.
  const groups = new Map<string, { plant: PlantInfo | null; sample: PlantEstimateInput; count: number }>()
  const unresolved = new Set<string>()

  for (const item of list) {
    const plant = resolvePlant(item)
    const key = plant?.id || `unknown:${labelFor(plant, item).toLowerCase()}`
    if (!plant) unresolved.add(key)
    const existing = groups.get(key)
    if (existing) existing.count += 1
    else groups.set(key, { plant, sample: item, count: 1 })
  }

  const byPlant: YieldEstimate[] = []
  const waterByPlant: PlanEstimate['water']['byPlant'] = []
  const strengths: string[] = []
  const cautions: string[] = []

  let gallonsPerWeek = 0
  let totalPounds = 0
  let lowPounds = 0
  let highPounds = 0
  let totalValue = 0
  let peak = 0

  for (const { plant, sample, count } of groups.values()) {
    const water = estimateWaterFor(plant, sample)
    const harvest = estimateYieldFor(plant, sample, count)

    gallonsPerWeek += water.gallonsPerWeek * count
    totalPounds += harvest.totalPounds
    totalValue += harvest.value

    // Reuse the database's min/max when it has them, so the band reflects real
    // variety rather than a fixed percentage.
    const measured = PLANT_YIELD_DATABASE[harvest.plantId]
    if (measured?.yieldPerPlant) {
      lowPounds += measured.yieldPerPlant.min * count
      highPounds += measured.yieldPerPlant.max * count
    } else {
      lowPounds += harvest.totalPounds * 0.75
      highPounds += harvest.totalPounds * 1.25
    }

    // Peak is the summer maximum: fruiting crops roughly double their base
    // need at the hottest point of the season.
    const peakFactor = water.source === 'database' && plant?.requirements.water === 'high' ? 1.4 : 1.15
    peak += water.gallonsPerWeek * count * peakFactor

    byPlant.push(harvest)
    waterByPlant.push({
      plantId: harvest.plantId,
      label: water.label,
      gallonsPerWeek: water.gallonsPerWeek * count,
      source: water.source,
    })
  }

  byPlant.sort((a, b) => b.value - a.value)
  waterByPlant.sort((a, b) => b.gallonsPerWeek - a.gallonsPerWeek)

  const waterNotes: string[] = []
  if (unresolved.size > 0) {
    waterNotes.push(
      `${unresolved.size} planting${unresolved.size === 1 ? '' : 's'} could not be matched to the plant library; a default water need was used.`
    )
  }
  const gallonsPerDay = gallonsPerWeek / 7
  if (gallonsPerWeek >= 200) {
    cautions.push(
      `Weekly water demand is about ${Math.round(gallonsPerWeek)} gallons, which usually needs a dedicated supply rather than a hose.`
    )
  } else if (gallonsPerWeek >= 60) {
    waterNotes.push(`Peak weekly demand is about ${Math.round(peak)} gallons; drip irrigation will cut that substantially.`)
  }

  // Strengths and cautions about the shape of the plan itself.
  const varieties = groups.size
  if (varieties >= 8) strengths.push(`${varieties} varieties gives the plan good pest and disease resilience.`)
  else if (varieties > 0 && varieties < 4) cautions.push(`Only ${varieties} varieties are planted; a monoculture is vulnerable to a single pest.`)

  const byCategory = new Set<PlantInfo['category']>()
  for (const { plant } of groups.values()) if (plant) byCategory.add(plant.category)
  if (byCategory.has('tree') || byCategory.has('shrub') || byCategory.has('fruit')) {
    strengths.push('Perennial species are present, which keeps producing beyond the first season.')
  } else if (list.length > 8) {
    cautions.push('No perennial species: every plant needs replanting each year.')
  }

  const legumeCount = [...groups.entries()].filter(([key]) =>
    ['beans', 'peas', 'clover'].includes(key)
  ).reduce((sum, [, group]) => sum + group.count, 0)
  if (legumeCount > 0) {
    strengths.push(`${legumeCount} legume planting${legumeCount === 1 ? '' : 's'} will add nitrogen to the soil.`)
  } else if (list.length > 5) {
    cautions.push('No nitrogen-fixing plants; a third of the bed as legumes would build fertility.');
  }

  const setupCost = number(setupCostCents)
  const firstYearNet = setupCost === null ? null : totalValue - setupCost / 100
  // Break-even is meaningful only when the first year does not already clear
  // the cost, and only when value exceeds it at all.
  const perYear = totalValue / 100
  const breakEvenYears =
    setupCost === null || perYear <= 0 || firstYearNet === null || firstYearNet >= 0
      ? null
      : Number((setupCost / 100 / perYear).toFixed(1))

  // Score: how estimable the plan is, nudged by its own diversity.
  const measured = [...groups.values()].filter(
    ({ plant }) => plant && PLANT_YIELD_DATABASE[plant.id]?.yieldPerPlant?.average !== undefined
  ).length
  const estimableShare = groups.size > 0 ? measured / groups.size : 0
  let score = Math.round(50 + estimableShare * 30)
  score += Math.min(15, Math.max(0, varieties - 2) * 2)
  if (byCategory.size >= 3) score += 5
  score = Math.max(0, Math.min(100, score))

  return {
    water: {
      gallonsPerWeek,
      gallonsPerDay,
      weeklyCost: Number((gallonsPerWeek * WATER_PRICE_PER_GALLON).toFixed(2)),
      peakGallonsPerWeek: peak,
      byPlant: waterByPlant,
      notes: waterNotes,
    },
    yield: {
      totalPounds,
      lowPounds,
      highPounds,
      totalValue,
      varieties,
      byPlant,
    },
    roi: {
      setupCost,
      annualValue: totalValue,
      firstYearNet,
      breakEvenYears,
    },
    score,
    strengths,
    cautions,
  }
}
