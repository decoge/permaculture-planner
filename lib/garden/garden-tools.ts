import { PLANT_LIBRARY, PlantInfo } from '@/lib/data/plant-library'
import { sunLabel } from '@/lib/garden/plan-summary'
import { RecordedTaskInput, SiteBedInput, SiteFactsInput, SitePlantInput } from '@/lib/garden/site-facts'

export interface GardenTools {
  sun: string[]
  water: string[]
  growth: string[]
  sectors: string[]
  succession: string[]
  materials: string[]
  zones: string[]
  tasks: string[]
  timeline: string[]
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

  const sectors = sectorLines(input, beds)
  const succession = successionLines(beds)
  const materialFacts = materialLines(input, beds)
  const zones = zoneLines(input, beds)
  const tasks = taskLines(input.tasks)
  const timeline = timelineLines(input, beds)

  return {
    sun,
    water: waterLines,
    growth,
    sectors,
    succession,
    materials: materialFacts,
    zones,
    tasks,
    timeline,
  }
}

type SowingMethod = 'direct' | 'transplant' | 'succession'

function isSowingMethod(value: string): value is SowingMethod {
  return value === 'direct' || value === 'transplant' || value === 'succession'
}

function sowingLabel(value: SowingMethod): string {
  switch (value) {
    case 'direct':
      return 'direct'
    case 'transplant':
      return 'transplant'
    case 'succession':
      return 'succession'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function recordedSowing(value: unknown): string | null {
  const text = recordedText(value)
  if (!text) return null
  return isSowingMethod(text) ? sowingLabel(text) : text
}

function recordedDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const text = recordedText(value)
  return text ? text.slice(0, 10) : null
}

function sequenceNote(value: unknown): string | null {
  const record = asRecord(value)
  if (!record) return recordedText(value)
  const extra = Object.entries(record).filter(([key]) => key !== 'position')
  if (extra.length === 0) return null
  return extra.map(([key, item]) => {
    if (typeof item === 'string' || typeof item === 'number') return `${key} ${item}`
    if (Array.isArray(item) && item.every((part) => typeof part === 'string' || typeof part === 'number')) {
      return `${key} ${item.join(', ')}`
    }
    return key
  }).join('; ')
}

function sectorLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  const shade = recordedText(input.shadeNotes)
  const slope = recordedNumber(input.slopePct)
  const lat = recordedNumber(input.lat)
  const lng = recordedNumber(input.lng)
  const constraints = asRecord(input.constraints)
  const savedSectors = recordedText(constraints?.sectors) || recordedText(asRecord(constraints?.sectors)?.name)
  lines.push(savedSectors
    ? `A sector record is saved: ${savedSectors}.`
    : 'No sector map is saved.')
  lines.push('Wind, fire, wildlife, noise, and views are not recorded.')
  lines.push(shade ? `Shade notes: ${shade}` : 'Shade notes are not recorded.')
  lines.push(lat !== null && lng !== null
    ? `Location is recorded as ${lat}, ${lng}. A sun path is not recorded.`
    : 'Latitude and longitude are not recorded, so a sun path is not recorded.')
  lines.push(slope === null
    ? 'Slope is not recorded.'
    : `Slope is recorded as ${formatQuantity(slope)}%.`)
  if (beds.length === 0) lines.push('No beds are saved.')
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const orientation = recordedText(bed.orientation)
    lines.push(orientation
      ? `${name} orientation is recorded as ${orientation}.`
      : `${name} orientation is not recorded.`)
  }
  return lines
}

function successionLines(beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  const plantings = beds.flatMap((bed) => plantsOn(bed).map((plant) => ({ bed, plant })))
  if (plantings.length === 0) {
    lines.push('No plants are saved.')
    lines.push('Planting season is not recorded.')
  }
  let anySequence = false
  for (const { bed, plant } of plantings) {
    const raw = String(plant.variety || plant.plantId || plant.name || '').trim()
    if (!raw) continue
    const known = libraryPlant(raw)
    const name = known?.name || titleCase(raw)
    const bedName = recordedText(bed.name) || 'Bed'
    const seasonText = recordedText(plant.season)
    const season = seasonText ? (isSeason(seasonText) ? seasonLabel(seasonText) : seasonText) : null
    const year = recordedNumber(plant.year)
    if (season) {
      lines.push(`${name} in ${bedName} is recorded for ${year === null ? season : `${season} ${formatQuantity(year)}`}.`)
    } else {
      lines.push(`${name} in ${bedName}: planting season is not recorded.`)
    }
    const family = recordedText(plant.family)
    lines.push(family
      ? `Saved plant family for ${name} in ${bedName} is recorded as ${family}.`
      : `Plant family for ${name} in ${bedName} is not recorded.`)
    const sowing = recordedSowing(plant.sowingMethod ?? plant.sowing_method)
    lines.push(sowing
      ? `Sowing method for ${name} in ${bedName} is recorded as ${sowing}.`
      : `Sowing method for ${name} in ${bedName} is not recorded.`)
    const sowDate = recordedDate(plant.sowDate ?? plant.sow_date)
    const transplantDate = recordedDate(plant.transplantDate ?? plant.transplant_date)
    const harvestStart = recordedDate(plant.harvestStart ?? plant.harvest_start)
    const harvestEnd = recordedDate(plant.harvestEnd ?? plant.harvest_end)
    lines.push(sowDate
      ? `Sow date for ${name} in ${bedName} is recorded as ${sowDate}.`
      : `Sow date for ${name} in ${bedName} is not recorded.`)
    lines.push(transplantDate
      ? `Transplant date for ${name} in ${bedName} is recorded as ${transplantDate}.`
      : `Transplant date for ${name} in ${bedName} is not recorded.`)
    lines.push(harvestStart || harvestEnd
      ? `Harvest dates for ${name} in ${bedName} are recorded as ${harvestStart || 'not recorded'} to ${harvestEnd || 'not recorded'}.`
      : `Harvest dates for ${name} in ${bedName} are not recorded.`)
    const sequence = sequenceNote(plant.successionsJson ?? plant.successions_json)
    if (sequence) {
      anySequence = true
      lines.push(`Succession note for ${name} in ${bedName}: ${sequence}.`)
    }
  }
  if (!anySequence) {
    lines.push('No crop sequence is recorded.')
    lines.push('A crop rotation is not recorded.')
  }
  return lines
}

function materialQuantity(label: string, value: unknown, unit: string): string {
  const recorded = recordedNumber(value)
  return recorded === null
    ? `${label} is not recorded.`
    : `${label} is recorded as ${formatQuantity(recorded)} ${unit}.`
}

function materialLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  if (beds.length === 0) lines.push('No beds are saved.')
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const length = recordedNumber(bed.lengthFt ?? bed.length_ft)
    const width = recordedNumber(bed.widthFt ?? bed.width_ft)
    const height = recordedNumber(bed.heightIn ?? bed.height_in)
    const size = [
      length === null ? 'length not recorded' : `${formatQuantity(length)} ft long`,
      width === null ? 'width not recorded' : `${formatQuantity(width)} ft wide`,
      height === null ? 'height not recorded' : `${formatQuantity(height)} in tall`,
    ].join(', ')
    lines.push(`${name} is recorded as ${size}.`)
    const clearance = recordedNumber(bed.pathClearanceIn ?? bed.path_clearance_in)
    lines.push(clearance === null
      ? `${name} path clearance is not recorded.`
      : `${name} path clearance is recorded as ${formatQuantity(clearance)} in.`)
    const trellis = recordedBoolean(bed.trellis)
    lines.push(trellis === null
      ? `${name} trellis is not recorded.`
      : `${name} trellis is recorded as ${trellis ? 'yes' : 'no'}.`)
  }
  const materials = input.materials
  if (!materials) {
    lines.push('Soil volume, compost, mulch, lumber, screws, drip line, emitters, row cover, and cost are not recorded.')
    return lines
  }
  lines.push(materialQuantity('Soil volume', materials.soilCuft ?? materials.soil_cuft, 'cu ft'))
  lines.push(materialQuantity('Compost', materials.compostCuft ?? materials.compost_cuft, 'cu ft'))
  lines.push(materialQuantity('Mulch', materials.mulchCuft ?? materials.mulch_cuft, 'cu ft'))
  lines.push(materialQuantity('Lumber', materials.lumberBoardfeet ?? materials.lumber_boardfeet, 'board feet'))
  lines.push(materialQuantity('Screws', materials.screwsCount ?? materials.screws_count, 'screws'))
  lines.push(materialQuantity('Drip line length', materials.dripLineFt ?? materials.drip_line_ft, 'ft'))
  lines.push(materialQuantity('Emitters', materials.emittersCount ?? materials.emitters_count, 'emitters'))
  lines.push(materialQuantity('Row cover', materials.rowCoverSqft ?? materials.row_cover_sqft, 'sq ft'))
  const cost = recordedNumber(materials.costEstimateCents ?? materials.cost_estimate_cents)
  lines.push(cost === null ? 'Cost is not recorded.' : `Cost is recorded as ${formatQuantity(cost)} cents.`)
  return lines
}

type TaskCategory = 'build' | 'plant' | 'maintain' | 'harvest' | 'water' | 'fertilize' | 'cover' | 'maint'

function isTaskCategory(value: string): value is TaskCategory {
  return value === 'build'
    || value === 'plant'
    || value === 'maintain'
    || value === 'harvest'
    || value === 'water'
    || value === 'fertilize'
    || value === 'cover'
    || value === 'maint'
}

function taskCategoryLabel(value: TaskCategory): string {
  switch (value) {
    case 'build':
      return 'build'
    case 'plant':
      return 'plant'
    case 'maintain':
      return 'maintain'
    case 'harvest':
      return 'harvest'
    case 'water':
      return 'water'
    case 'fertilize':
      return 'fertilize'
    case 'cover':
      return 'cover'
    case 'maint':
      return 'maint'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function recordedZoneValue(value: unknown): string | null {
  const number = recordedNumber(value)
  if (number !== null) return formatQuantity(number)
  return recordedText(value)
}

function zoneLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  const usda = recordedText(input.usdaZone)
  lines.push(usda ? `USDA zone is recorded as ${usda}.` : 'USDA zone is not recorded.')
  if (beds.length === 0) {
    lines.push('No beds are saved.')
    lines.push('A permaculture zone is not recorded.')
    return lines
  }
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const notes = asRecord(bed.notes)
    const zone = recordedZoneValue(bed.zone) || recordedZoneValue(notes?.zone)
    lines.push(zone
      ? `${name} permaculture zone is recorded as ${zone}.`
      : `${name} permaculture zone is not recorded.`)
  }
  return lines
}

function taskLines(tasks: RecordedTaskInput[] | null | undefined): string[] {
  const rows = tasks || []
  if (rows.length === 0) return ['No tasks are recorded.']
  const lines: string[] = []
  let anyRecurrence = false
  for (const task of rows) {
    const title = recordedText(task.title) || 'Untitled task'
    const categoryText = recordedText(task.category)
    const category = categoryText
      ? (isTaskCategory(categoryText) ? taskCategoryLabel(categoryText) : categoryText)
      : null
    const due = recordedDate(task.dueOn ?? task.due_on)
    const completed = recordedBoolean(task.completed)
    const status = completed === null
      ? 'completion is not recorded'
      : completed ? 'completed' : 'not completed'
    const parts = [
      category ? `recorded as ${category}` : 'category is not recorded',
      due ? `due ${due}` : 'due date is not recorded',
      status,
    ]
    lines.push(`${title} is ${parts.join(', ')}.`)
    const description = recordedText(task.description)
    if (description) lines.push(`${title} notes: ${description}.`)
    const recurrence = recordedText(task.recurringPattern ?? task.recurring_pattern)
    if (recurrence) {
      anyRecurrence = true
      lines.push(`${title} repeats as ${recurrence}.`)
    }
  }
  if (!anyRecurrence) lines.push('A recurring schedule is not recorded.')
  return lines
}

function timelineLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  const plantings = beds.flatMap((bed) => plantsOn(bed).map((plant) => ({ bed, plant })))
  if (plantings.length === 0) {
    lines.push('No plants are saved.')
    lines.push('Planting season is not recorded.')
  }
  for (const { bed, plant } of plantings) {
    const raw = String(plant.variety || plant.plantId || plant.name || '').trim()
    if (!raw) continue
    const known = libraryPlant(raw)
    const name = known?.name || titleCase(raw)
    const bedName = recordedText(bed.name) || 'Bed'
    const seasonText = recordedText(plant.season)
    const season = seasonText ? (isSeason(seasonText) ? seasonLabel(seasonText) : seasonText) : null
    const year = recordedNumber(plant.year)
    lines.push(season
      ? `${name} in ${bedName} is recorded for ${year === null ? season : `${season} ${formatQuantity(year)}`}.`
      : `${name} in ${bedName}: planting season is not recorded.`)
    const days = recordedNumber(plant.targetDaysToMaturity ?? plant.target_days_to_maturity)
    lines.push(days === null
      ? `Days to maturity for ${name} in ${bedName} are not recorded.`
      : `Days to maturity for ${name} in ${bedName} are recorded as ${formatQuantity(days)}.`)
    const sowing = recordedSowing(plant.sowingMethod ?? plant.sowing_method)
    lines.push(sowing
      ? `Sowing method for ${name} in ${bedName} is recorded as ${sowing}.`
      : `Sowing method for ${name} in ${bedName} is not recorded.`)
    const sowDate = recordedDate(plant.sowDate ?? plant.sow_date)
    const transplantDate = recordedDate(plant.transplantDate ?? plant.transplant_date)
    const harvestStart = recordedDate(plant.harvestStart ?? plant.harvest_start)
    const harvestEnd = recordedDate(plant.harvestEnd ?? plant.harvest_end)
    lines.push(sowDate
      ? `Sow date for ${name} in ${bedName} is recorded as ${sowDate}.`
      : `Sow date for ${name} in ${bedName} is not recorded.`)
    lines.push(transplantDate
      ? `Transplant date for ${name} in ${bedName} is recorded as ${transplantDate}.`
      : `Transplant date for ${name} in ${bedName} is not recorded.`)
    lines.push(harvestStart || harvestEnd
      ? `Harvest dates for ${name} in ${bedName} are recorded as ${harvestStart || 'not recorded'} to ${harvestEnd || 'not recorded'}.`
      : `Harvest dates for ${name} in ${bedName} are not recorded.`)
  }
  const lastFrost = recordedDate(input.lastFrost)
  const firstFrost = recordedDate(input.firstFrost)
  if (lastFrost && firstFrost) {
    lines.push(`Last frost is recorded as ${lastFrost}.`)
    lines.push(`First frost is recorded as ${firstFrost}.`)
  } else {
    lines.push('Last frost and first frost are not recorded.')
  }
  lines.push('A planting calendar is not calculated.')
  return lines
}

export function formatGardenTools(tools: GardenTools): string {
  const sections: Array<[string, string[]]> = [
    ['Sun', tools.sun],
    ['Water', tools.water],
    ['Growth', tools.growth],
    ['Sectors', tools.sectors],
    ['Succession', tools.succession],
    ['Materials', tools.materials],
    ['Zones', tools.zones],
    ['Tasks', tools.tasks],
    ['Timeline', tools.timeline],
  ]
  return sections.flatMap(([title, lines]) => [title, ...lines.map((line) => `- ${line}`), '']).join('\n').trim()
}
