import { PLANT_LIBRARY, PlantInfo } from '@/lib/data/plant-library'
import { sunLabel } from '@/lib/garden/plan-summary'
import { SiteBedInput, SiteFactsInput, SitePlantInput } from '@/lib/garden/site-facts'

export interface GardenTools {
  sun: string[]
  water: string[]
  growth: string[]
}

type WaterNeed = PlantInfo['requirements']['water']
type WaterSource = 'spigot' | 'rain' | 'none' | 'drip'
type Season = 'spring' | 'summer' | 'fall' | 'winter'

interface ListedPlant {
  name: string
  bedName: string
  info: PlantInfo | null
  spacingIn: number | null
  days: number | null
  season: string | null
  year: number | null
}

function recordedNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function recordedText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function recordedBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function formatQuantity(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value) as unknown)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function libraryPlant(label: string): PlantInfo | undefined {
  const key = label.trim().toLowerCase()
  if (!key) return undefined
  return PLANT_LIBRARY.find((plant) => plant.id === key || plant.name.toLowerCase() === key)
}

function plantsOn(bed: SiteBedInput): SitePlantInput[] {
  if (bed.plantings && bed.plantings.length > 0) return bed.plantings
  return bed.plants || []
}

function isWaterSource(value: string): value is WaterSource {
  return value === 'spigot' || value === 'rain' || value === 'none' || value === 'drip'
}

function waterSourceLabel(value: WaterSource): string {
  switch (value) {
    case 'spigot':
      return 'a spigot'
    case 'rain':
      return 'rain'
    case 'none':
      return 'none'
    case 'drip':
      return 'drip'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function recordedWater(value: unknown): string | null {
  const text = recordedText(value)
  if (!text) return null
  return isWaterSource(text) ? waterSourceLabel(text) : text
}

function waterNeedLabel(value: WaterNeed): string {
  switch (value) {
    case 'low':
      return 'low water'
    case 'medium':
      return 'medium water'
    case 'high':
      return 'high water'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function isSeason(value: string): value is Season {
  return value === 'spring' || value === 'summer' || value === 'fall' || value === 'winter'
}

function seasonLabel(value: Season): string {
  switch (value) {
    case 'spring':
      return 'spring'
    case 'summer':
      return 'summer'
    case 'fall':
      return 'fall'
    case 'winter':
      return 'winter'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function listPlants(beds: SiteBedInput[]): ListedPlant[] {
  return beds.flatMap((bed) => {
    const bedName = recordedText(bed.name) || 'Bed'
    return plantsOn(bed).flatMap((plant) => {
      const raw = String(plant.variety || plant.plantId || plant.name || '').trim()
      if (!raw) return []
      const known = libraryPlant(raw)
      return [{
        name: known?.name || titleCase(raw),
        bedName,
        info: known || null,
        spacingIn: recordedNumber(plant.spacingIn ?? plant.spacing_in),
        days: recordedNumber(plant.targetDaysToMaturity ?? plant.target_days_to_maturity),
        season: recordedText(plant.season),
        year: recordedNumber(plant.year),
      }]
    })
  })
}

export function summarizeGardenTools(input: SiteFactsInput): GardenTools {
  const beds = input.beds || []
  const plants = listPlants(beds)
  const constraints = asRecord(input.constraints)
  const water = asRecord(constraints?.water)
  const shade = recordedText(input.shadeNotes)
  const lat = recordedNumber(input.lat)
  const lng = recordedNumber(input.lng)
  const lastFrost = recordedText(input.lastFrost)
  const firstFrost = recordedText(input.firstFrost)
  const columnWater = recordedWater(input.waterSource)
  const constraintWater = recordedWater(water?.source)
  const materials = input.materials || null

  const sun: string[] = []
  if (plants.length === 0) {
    sun.push('No plants are saved.')
  }
  const sunCounts = { full: 0, partial: 0, shade: 0, unknown: 0 }
  const librarySpacing = new Map<string, number>()
  for (const plant of plants) {
    const sunText = plant.info ? sunLabel(plant.info.requirements.sun) : null
    if (plant.info) {
      sunCounts[plant.info.requirements.sun] += 1
      librarySpacing.set(plant.name, plant.info.size.spacing)
    } else {
      sunCounts.unknown += 1
    }
    const spacing = plant.spacingIn === null
      ? 'spacing is not recorded'
      : `spacing recorded as ${formatQuantity(plant.spacingIn)} in`
    sun.push(sunText
      ? `${plant.name} in ${plant.bedName}: ${sunText} from the plant library, ${spacing}.`
      : `${plant.name} in ${plant.bedName}: sun not recorded, ${spacing}.`)
  }
  if (plants.length > 0) {
    sun.push(`Full sun: ${sunCounts.full}. Partial sun: ${sunCounts.partial}. Shade: ${sunCounts.shade}.`)
    if (sunCounts.unknown > 0) sun.push(`Sun not recorded: ${sunCounts.unknown}.`)
  }
  for (const [name, libraryIn] of librarySpacing) {
    const saved = plants.filter((plant) => plant.name === name && plant.spacingIn !== null)
    const differs = saved.some((plant) => plant.spacingIn !== libraryIn)
    if (differs || saved.length === 0) {
      sun.push(`The plant library lists ${formatQuantity(libraryIn)} in spacing for ${name}.`)
    }
  }
  sun.push(shade ? `Shade notes: ${shade}` : 'Shade notes are not recorded.')
  sun.push(lat !== null && lng !== null
    ? `Location is recorded as ${lat}, ${lng}. Sunlight hours are not recorded.`
    : 'Latitude and longitude are not recorded, so sunlight hours are not recorded.')
  for (const bed of beds) {
    const orientation = recordedText(bed.orientation)
    if (orientation) sun.push(`${recordedText(bed.name) || 'Bed'} orientation is recorded as ${orientation}.`)
  }

  const waterLines: string[] = []
  if (columnWater) waterLines.push(`Water source is recorded as ${columnWater}.`)
  else if (constraintWater) waterLines.push(`Water source is recorded as ${constraintWater}.`)
  else waterLines.push('Water source is not recorded.')
  const dripAllowed = recordedBoolean(water?.drip_allowed)
  waterLines.push(dripAllowed === null
    ? 'Drip irrigation is not recorded.'
    : `Drip irrigation is recorded as ${dripAllowed ? 'allowed' : 'not allowed'}.`)
  const dripLength = recordedNumber(materials?.dripLineFt ?? materials?.drip_line_ft)
  waterLines.push(dripLength === null
    ? 'Drip line length is not recorded.'
    : `Drip line length is recorded as ${formatQuantity(dripLength)} ft.`)
  if (beds.length === 0) waterLines.push('No beds are saved.')
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const wicking = recordedBoolean(bed.wicking)
    waterLines.push(wicking === null
      ? `${name} wicking is not recorded.`
      : `${name} wicking is recorded as ${wicking ? 'yes' : 'no'}.`)
  }
  const seenWater = new Set<string>()
  for (const plant of plants) {
    if (!plant.info || seenWater.has(plant.name)) continue
    seenWater.add(plant.name)
    waterLines.push(`From the plant library, ${plant.name} needs ${waterNeedLabel(plant.info.requirements.water)}.`)
  }
  for (const plant of plants) {
    if (plant.info || seenWater.has(plant.name)) continue
    seenWater.add(plant.name)
    waterLines.push(`${plant.name} is not in the plant library, so its water need is not recorded.`)
  }
  waterLines.push('Rainfall is not recorded.')
  waterLines.push('Flow rate is not recorded.')

  const growth: string[] = []
  if (plants.length === 0) {
    growth.push('No plants are saved.')
    growth.push('Planting season is not recorded.')
    growth.push('Days to maturity are not recorded.')
  }
  let recordedDays = false
  let recordedSeason = false
  for (const plant of plants) {
    const season = plant.season ? (isSeason(plant.season) ? seasonLabel(plant.season) : plant.season) : null
    if (season) {
      recordedSeason = true
      const when = plant.year === null ? season : `${season} ${formatQuantity(plant.year)}`
      growth.push(`${plant.name} in ${plant.bedName} is recorded for ${when}.`)
    } else {
      growth.push(`${plant.name} in ${plant.bedName}: planting season is not recorded.`)
    }
    if (plant.days === null) {
      growth.push(`Days to maturity for ${plant.name} in ${plant.bedName} are not recorded.`)
    } else {
      recordedDays = true
      growth.push(`Days to maturity for ${plant.name} in ${plant.bedName} are recorded as ${formatQuantity(plant.days)}.`)
    }
  }
  if (plants.length > 0 && !recordedSeason) {
    growth.push('Planting season is not recorded.')
  }
  if (plants.length > 0 && !recordedDays) {
    growth.push('Days to maturity are not recorded.')
  }
  const seenTiming = new Set<string>()
  for (const plant of plants) {
    if (!plant.info || seenTiming.has(plant.name)) continue
    seenTiming.add(plant.name)
    growth.push(`From the plant library, ${plant.name} is planted in ${plant.info.planting_time} and harvested in ${plant.info.harvest_time}.`)
  }
  if (lastFrost && firstFrost) {
    growth.push(`Last frost is recorded as ${lastFrost.slice(0, 10)}.`)
    growth.push(`First frost is recorded as ${firstFrost.slice(0, 10)}.`)
  } else {
    growth.push('Last frost and first frost are not recorded.')
  }
  growth.push('A growth curve is not calculated.')

  return { sun, water: waterLines, growth }
}

export function formatGardenTools(tools: GardenTools): string {
  const sections: Array<[string, string[]]> = [
    ['Sun', tools.sun],
    ['Water', tools.water],
    ['Growth', tools.growth],
  ]
  return sections.flatMap(([title, lines]) => [title, ...lines.map((line) => `- ${line}`), '']).join('\n').trim()
}
