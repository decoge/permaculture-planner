import { PLANT_LIBRARY, PlantInfo } from '@/lib/data/plant-library'

export interface SitePlantInput {
  variety?: unknown
  plantId?: unknown
  name?: unknown
  family?: unknown
  season?: unknown
  year?: unknown
  spacingIn?: unknown
  spacing_in?: unknown
  targetDaysToMaturity?: unknown
  target_days_to_maturity?: unknown
}

export interface HarvestInput {
  quantity?: unknown
  unit?: unknown
  variety?: unknown
  notes?: unknown
}

export interface SiteBedInput {
  name?: unknown
  surface?: unknown
  heightIn?: unknown
  height_in?: unknown
  orientation?: unknown
  wicking?: unknown
  trellis?: unknown
  pathClearanceIn?: unknown
  path_clearance_in?: unknown
  elementCategory?: unknown
  elementType?: unknown
  notes?: unknown
  plants?: SitePlantInput[]
  plantings?: SitePlantInput[]
}

export interface SiteMaterialsInput {
  soilCuft?: unknown
  soil_cuft?: unknown
  compostCuft?: unknown
  compost_cuft?: unknown
  mulchCuft?: unknown
  mulch_cuft?: unknown
  dripLineFt?: unknown
  drip_line_ft?: unknown
  costEstimateCents?: unknown
  cost_estimate_cents?: unknown
}

export interface SiteFactsInput {
  usdaZone?: unknown
  lastFrost?: unknown
  firstFrost?: unknown
  lat?: unknown
  lng?: unknown
  surfaceType?: unknown
  slopePct?: unknown
  shadeNotes?: unknown
  waterSource?: unknown
  constraints?: unknown
  beds?: SiteBedInput[]
  materials?: SiteMaterialsInput | null
  harvests?: HarvestInput[] | null
}

export interface SiteFacts {
  soil: string[]
  topography: string[]
  climate: string[]
  infrastructure: string[]
  biodiversity: string[]
  energy: string[]
  community: string[]
  economics: string[]
  resilience: string[]
}

type Surface = 'soil' | 'hard' | 'rooftop' | 'concrete'
type WaterSource = 'spigot' | 'rain' | 'none' | 'drip'
type LibrarySoil = PlantInfo['requirements']['soil']
type ElementCategory = 'bed' | 'water_management' | 'structure' | 'access' | 'energy' | 'animal' | 'waste'

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

function isSurface(value: string): value is Surface {
  return value === 'soil' || value === 'hard' || value === 'rooftop' || value === 'concrete'
}

function surfaceLabel(value: Surface): string {
  switch (value) {
    case 'soil':
      return 'soil'
    case 'hard':
      return 'a hard surface'
    case 'rooftop':
      return 'a rooftop'
    case 'concrete':
      return 'concrete'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function recordedSurface(value: unknown): string | null {
  const text = recordedText(value)
  if (!text) return null
  return isSurface(text) ? surfaceLabel(text) : text
}

function isWaterSource(value: string): value is WaterSource {
  return value === 'spigot' || value === 'rain' || value === 'none' || value === 'drip'
}

function waterLabel(value: WaterSource): string {
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
  return isWaterSource(text) ? waterLabel(text) : text
}

function soilPreference(value: LibrarySoil): string {
  switch (value) {
    case 'sandy':
      return 'sandy soil'
    case 'loamy':
      return 'loamy soil'
    case 'clay':
      return 'clay soil'
    case 'any':
      return 'any soil'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function isElementCategory(value: string): value is ElementCategory {
  return value === 'bed'
    || value === 'water_management'
    || value === 'structure'
    || value === 'access'
    || value === 'energy'
    || value === 'animal'
    || value === 'waste'
}

function elementLabel(value: ElementCategory): string {
  switch (value) {
    case 'bed':
      return 'a bed'
    case 'water_management':
      return 'water management'
    case 'structure':
      return 'a structure'
    case 'access':
      return 'access'
    case 'energy':
      return 'energy'
    case 'animal':
      return 'an animal system'
    case 'waste':
      return 'a waste system'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function libraryPlant(label: string): PlantInfo | undefined {
  const key = label.trim().toLowerCase()
  if (!key) return undefined
  return PLANT_LIBRARY.find((plant) => plant.id === key || plant.name.toLowerCase() === key)
}

function titleCase(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function plantsOn(bed: SiteBedInput): SitePlantInput[] {
  if (bed.plantings && bed.plantings.length > 0) return bed.plantings
  return bed.plants || []
}

function plantLabel(plant: SitePlantInput): string {
  return String(plant.variety || plant.plantId || plant.name || '').trim()
}

function zoneNumber(zone: string): number | null {
  const match = zone.match(/^(\d{1,2})/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function dayCount(lastFrost: string, firstFrost: string): number | null {
  const start = Date.parse(`${lastFrost.slice(0, 10)}T00:00:00Z`)
  const end = Date.parse(`${firstFrost.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.round((end - start) / 86400000)
}

function savedElements(bed: SiteBedInput): string | null {
  const notes = asRecord(bed.notes)
  const raw = recordedText(bed.elementCategory) || recordedText(notes?.elementCategory)
  const name = recordedText(bed.name) || recordedText(bed.elementType) || 'Saved element'
  if (!raw || raw === 'bed') return null
  const label = isElementCategory(raw) ? elementLabel(raw) : raw
  return `${name} is recorded as ${label}.`
}

function quantityLine(label: string, value: unknown, unit: string): string {
  const recorded = recordedNumber(value)
  return recorded === null
    ? `${label} is not recorded.`
    : `${label} is recorded as ${formatQuantity(recorded)} ${unit}.`
}

function recordedCategory(bed: SiteBedInput): string | null {
  const notes = asRecord(bed.notes)
  return recordedText(bed.elementCategory) || recordedText(notes?.elementCategory)
}

type Season = 'spring' | 'summer' | 'fall' | 'winter'

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

function categoryPlural(value: PlantInfo['category']): string {
  switch (value) {
    case 'vegetable':
      return 'vegetables'
    case 'fruit':
      return 'fruit'
    case 'herb':
      return 'herbs'
    case 'flower':
      return 'flowers'
    case 'tree':
      return 'trees'
    case 'shrub':
      return 'shrubs'
    case 'groundcover':
      return 'groundcovers'
    case 'vine':
      return 'vines'
    default: {
      const unexpected: never = value
      return unexpected
    }
  }
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const dollars = Math.floor(absolute / 100)
  const remainder = Math.round(absolute % 100)
  return `${sign}$${dollars}.${String(remainder).padStart(2, '0')}`
}

export function summarizeSiteFacts(input: SiteFactsInput): SiteFacts {
  const beds = input.beds || []
  const constraints = asRecord(input.constraints)
  const area = asRecord(constraints?.area)
  const water = asRecord(constraints?.water)
  const crops = asRecord(constraints?.crops)
  const materials = input.materials || null
  const surface = recordedSurface(input.surfaceType)
  const slope = recordedNumber(input.slopePct)
  const zone = recordedText(input.usdaZone)
  const shade = recordedText(input.shadeNotes)
  const columnWater = recordedWater(input.waterSource)
  const constraintWater = recordedWater(water?.source)
  const lastFrost = recordedText(input.lastFrost)
  const firstFrost = recordedText(input.firstFrost)
  const lat = recordedNumber(input.lat)
  const lng = recordedNumber(input.lng)

  const seenPlants = new Map<string, PlantInfo | null>()
  for (const bed of beds) {
    for (const plant of plantsOn(bed)) {
      const raw = plantLabel(plant)
      if (!raw) continue
      const known = libraryPlant(raw)
      const name = known?.name || titleCase(raw)
      if (!seenPlants.has(name)) seenPlants.set(name, known || null)
    }
  }

  const soil: string[] = [
    surface ? `Site surface is recorded as ${surface}.` : 'Site surface is not recorded.',
  ]
  if (beds.length === 0) {
    soil.push('No beds are saved on this plan.')
  }
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const bedSurface = recordedSurface(bed.surface)
    soil.push(bedSurface
      ? `${name} surface is recorded as ${bedSurface}.`
      : `${name} surface is not recorded.`)
  }
  soil.push('No soil test is recorded.')
  if (seenPlants.size === 0) {
    soil.push('No plants are saved, so the plant library has no soil preference to show.')
  }
  for (const [name, plant] of seenPlants) {
    soil.push(plant
      ? `From the plant library, ${name} prefers ${soilPreference(plant.requirements.soil)}.`
      : `${name} is not in the plant library, so its soil preference is not recorded.`)
  }
  if (!materials) {
    soil.push('Soil volume, compost, and mulch are not recorded.')
  } else {
    soil.push(quantityLine('Soil volume', materials.soilCuft ?? materials.soil_cuft, 'cu ft'))
    soil.push(quantityLine('Compost', materials.compostCuft ?? materials.compost_cuft, 'cu ft'))
    soil.push(quantityLine('Mulch', materials.mulchCuft ?? materials.mulch_cuft, 'cu ft'))
  }

  const topography: string[] = [
    slope === null ? 'Slope is not recorded.' : `Slope is recorded as ${formatQuantity(slope)}%.`,
    'Aspect and elevation are not recorded.',
  ]
  const totalSqFt = recordedNumber(area?.total_sqft)
  const shape = recordedText(area?.shape)
  const usable = recordedNumber(area?.usable_fraction)
  topography.push(totalSqFt === null
    ? 'Site area is not recorded.'
    : `Site area is recorded as ${formatQuantity(totalSqFt)} sq ft.`)
  topography.push(shape
    ? `Site shape is recorded as ${shape}.`
    : 'Site shape is not recorded.')
  topography.push(usable === null
    ? 'Usable fraction is not recorded.'
    : `Usable fraction is recorded as ${formatQuantity(usable)}.`)

  const climate: string[] = [
    zone ? `USDA zone is recorded as ${zone}.` : 'USDA zone is not recorded.',
  ]
  if (lastFrost && firstFrost) {
    const days = dayCount(lastFrost, firstFrost)
    climate.push(`Last frost is recorded as ${lastFrost.slice(0, 10)}.`)
    climate.push(`First frost is recorded as ${firstFrost.slice(0, 10)}.`)
    climate.push(days === null
      ? 'The saved frost dates do not give a season length.'
      : `The days between those frost dates are ${days}.`)
  } else {
    climate.push('Last frost and first frost are not recorded.')
  }
  climate.push(lat !== null && lng !== null
    ? `Location is recorded as ${lat}, ${lng}.`
    : 'Latitude and longitude are not recorded.')
  climate.push(shade ? `Shade notes: ${shade}` : 'Shade notes are not recorded.')
  climate.push('Rainfall is not recorded.')
  const zoneMajor = zone ? zoneNumber(zone) : null
  if (!zone) {
    climate.push('USDA zone is not recorded, so plant hardiness is not compared.')
  } else if (seenPlants.size === 0) {
    climate.push('No plants are saved to compare with the zone.')
  } else if (zoneMajor === null) {
    climate.push('The saved zone cannot be compared with the plant library.')
  } else {
    const listed: string[] = []
    const unlisted: string[] = []
    for (const [name, plant] of seenPlants) {
      if (!plant) continue
      if (plant.requirements.zone.includes(String(zoneMajor))) listed.push(name)
      else unlisted.push(name)
    }
    if (listed.length > 0) climate.push(`Listed for USDA zone ${zoneMajor}: ${listed.join(', ')}.`)
    if (unlisted.length > 0) climate.push(`Not listed for USDA zone ${zoneMajor}: ${unlisted.join(', ')}.`)
  }
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const orientation = recordedText(bed.orientation)
    climate.push(orientation
      ? `${name} orientation is recorded as ${orientation}.`
      : `${name} orientation is not recorded.`)
  }

  const infrastructure: string[] = []
  if (columnWater) {
    infrastructure.push(`Water source is recorded as ${columnWater}.`)
  } else if (constraintWater) {
    infrastructure.push(`Water source is recorded as ${constraintWater}.`)
  } else {
    infrastructure.push('Water source is not recorded.')
  }
  if (columnWater && constraintWater && columnWater !== constraintWater) {
    infrastructure.push(`Site notes also record the water source as ${constraintWater}.`)
  }
  const dripAllowed = recordedBoolean(water?.drip_allowed)
  infrastructure.push(dripAllowed === null
    ? 'Drip irrigation is not recorded.'
    : `Drip irrigation is recorded as ${dripAllowed ? 'allowed' : 'not allowed'}.`)
  const sipInterest = recordedBoolean(water?.sip_interest)
  infrastructure.push(sipInterest === null
    ? 'Sub-irrigated planters are not recorded.'
    : `Sub-irrigated planters are recorded as ${sipInterest ? 'requested' : 'not requested'}.`)
  infrastructure.push(quantityLine(
    'Drip line length',
    materials?.dripLineFt ?? materials?.drip_line_ft,
    'ft',
  ))
  const weekly = recordedNumber(crops?.time_weekly_minutes)
  infrastructure.push(weekly === null
    ? 'Weekly garden time is not recorded.'
    : `Weekly garden time is recorded as ${formatQuantity(weekly)} minutes.`)
  if (beds.length === 0) {
    infrastructure.push('No beds are saved on this plan.')
  }
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const height = recordedNumber(bed.heightIn ?? bed.height_in)
    const clearance = recordedNumber(bed.pathClearanceIn ?? bed.path_clearance_in)
    const trellis = recordedBoolean(bed.trellis)
    const wicking = recordedBoolean(bed.wicking)
    infrastructure.push(
      `${name}: height ${height === null ? 'not recorded' : `${formatQuantity(height)} in`}, `
      + `path clearance ${clearance === null ? 'not recorded' : `${formatQuantity(clearance)} in`}, `
      + `trellis ${trellis === null ? 'not recorded' : trellis ? 'yes' : 'no'}, `
      + `wicking ${wicking === null ? 'not recorded' : wicking ? 'yes' : 'no'}.`,
    )
  }
  const elements = beds.map(savedElements).filter((line): line is string => Boolean(line))
  infrastructure.push(...elements)
  if (elements.length === 0) {
    infrastructure.push('No buildings, fences, or utility lines are saved on this plan.')
  }

  const plantingCount = beds.reduce((sum, bed) => sum + plantsOn(bed).length, 0)
  const species = [...seenPlants.keys()]
  const families = new Set<string>()
  const seasons = new Set<string>()
  let missingFamily = false
  for (const bed of beds) {
    for (const plant of plantsOn(bed)) {
      const family = recordedText(plant.family)
      if (family) families.add(family)
      else if (plantLabel(plant)) missingFamily = true
      const season = recordedText(plant.season)
      const year = recordedNumber(plant.year)
      if (season) {
        const label = isSeason(season) ? seasonLabel(season) : season
        seasons.add(year === null ? label : `${label} ${formatQuantity(year)}`)
      }
    }
  }

  const biodiversity: string[] = []
  if (species.length === 0) {
    biodiversity.push('No plants are saved.')
  } else {
    biodiversity.push(`${plantingCount} plantings are saved.`)
    biodiversity.push(`${species.length} species are saved: ${joinNames(species)}.`)
  }
  if (families.size > 0) {
    biodiversity.push(`Saved plant family is recorded as ${[...families].join(', ')}.`)
  }
  if (missingFamily && families.size > 0) {
    biodiversity.push('Plant family is not recorded for every planting.')
  }
  if (species.length > 0 && families.size === 0) {
    biodiversity.push('Plant family is not recorded.')
  }
  const categories = new Map<string, string[]>()
  for (const [name, plant] of seenPlants) {
    if (!plant) {
      biodiversity.push(`${name} is not in the plant library.`)
      continue
    }
    const label = categoryPlural(plant.category)
    const names = categories.get(label) || []
    names.push(name)
    categories.set(label, names)
  }
  for (const [label, names] of categories) {
    biodiversity.push(`From the plant library, ${joinNames(names)} are ${label}.`)
  }
  const companionLines: string[] = []
  for (const bed of beds) {
    const named = plantsOn(bed).flatMap((plant) => {
      const known = libraryPlant(plantLabel(plant))
      return known ? [known] : []
    })
    const bedName = recordedText(bed.name) || 'this bed'
    for (let i = 0; i < named.length; i += 1) {
      for (let j = i + 1; j < named.length; j += 1) {
        const left = named[i]
        const right = named[j]
        if (left.companions.includes(right.id) || right.companions.includes(left.id)) {
          companionLines.push(`From the plant library, ${left.name} and ${right.name} are companions in ${bedName}.`)
        }
      }
    }
  }
  biodiversity.push(...companionLines)
  if (species.length > 0 && companionLines.length === 0) {
    biodiversity.push('No companion pairs from the plant library share a bed.')
  }
  const habitat = beds
    .filter((bed) => {
      const category = recordedCategory(bed)
      return category === 'animal' || category === 'waste'
    })
    .map(savedElements)
    .filter((line): line is string => Boolean(line))
  biodiversity.push(...habitat)
  biodiversity.push('Wildlife, pollinators, native plants, and habitat corridors are not recorded.')

  const energyElements = beds
    .filter((bed) => recordedCategory(bed) === 'energy')
    .map(savedElements)
    .filter((line): line is string => Boolean(line))
  const energy: string[] = [
    'Energy use is not recorded.',
    'Solar, wind, and thermal mass are not recorded.',
  ]
  for (const bed of beds) {
    const name = recordedText(bed.name) || 'Bed'
    const orientation = recordedText(bed.orientation)
    if (orientation) energy.push(`${name} orientation is recorded as ${orientation}.`)
  }
  if (energyElements.length === 0) energy.push('No energy systems are saved on this plan.')
  else energy.push(...energyElements)

  const communityRecord = asRecord(constraints?.community)
  const communityName = recordedText(constraints?.community)
    || recordedText(communityRecord?.name)
    || recordedText(communityRecord?.program)
  const focus = Array.isArray(crops?.focus)
    ? crops.focus.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []
  const community: string[] = [
    communityName
      ? `A community record is saved: ${communityName}.`
      : 'Community programs, shared plots, volunteers, and teaching areas are not recorded.',
    focus.length > 0
      ? `Crop focus is recorded as ${focus.join(', ')}.`
      : 'Crop focus is not recorded.',
  ]
  community.push(weekly === null
    ? 'Weekly garden time is not recorded.'
    : `Weekly garden time is recorded as ${formatQuantity(weekly)} minutes. That record does not name a community program.`)

  const harvests = input.harvests || []
  const economics: string[] = []
  if (harvests.length === 0) {
    economics.push('No harvests are recorded.')
    economics.push('Yields are not recorded.')
  } else {
    for (const harvest of harvests) {
      const crop = recordedText(harvest.variety) || 'A crop'
      const quantity = recordedNumber(harvest.quantity)
      const unit = recordedText(harvest.unit)
      economics.push(quantity === null
        ? `${titleCase(crop)} has a harvest record without a quantity.`
        : `${titleCase(crop)} harvest is recorded as ${formatQuantity(quantity)}${unit ? ` ${unit}` : ''}.`)
    }
  }
  economics.push('Prices are not recorded.')
  const costCents = recordedNumber(materials?.costEstimateCents ?? materials?.cost_estimate_cents)
  economics.push(costCents === null
    ? 'Cost is not recorded.'
    : `Cost is recorded as ${formatCents(costCents)}.`)
  economics.push(weekly === null
    ? 'Weekly garden time is not recorded.'
    : `Weekly garden time is recorded as ${formatQuantity(weekly)} minutes.`)
  economics.push('Labor cost is not recorded.')

  const resilience: string[] = []
  if (species.length === 0) resilience.push('No plants are saved.')
  else resilience.push(`${species.length} species are saved: ${joinNames(species)}.`)
  resilience.push(seasons.size > 0
    ? `Plantings are recorded for ${[...seasons].join(', ')}.`
    : 'Planting season is not recorded.')
  resilience.push(columnWater
    ? `Water source is recorded as ${columnWater}.`
    : constraintWater
      ? `Water source is recorded as ${constraintWater}.`
      : 'Water source is not recorded.')
  resilience.push(harvests.length === 0
    ? 'No harvests are recorded.'
    : harvests.length === 1
      ? '1 harvest record is saved.'
      : `${harvests.length} harvest records are saved.`)
  resilience.push('Calories, stored food, and seed saving are not recorded.')

  return { soil, topography, climate, infrastructure, biodiversity, energy, community, economics, resilience }
}

export function formatSiteFacts(facts: SiteFacts): string {
  const sections: Array<[string, string[]]> = [
    ['Soil', facts.soil],
    ['Topography', facts.topography],
    ['Climate', facts.climate],
    ['Infrastructure', facts.infrastructure],
    ['Biodiversity', facts.biodiversity],
    ['Energy', facts.energy],
    ['Community', facts.community],
    ['Economics', facts.economics],
    ['Resilience', facts.resilience],
  ]
  return sections.flatMap(([title, lines]) => [title, ...lines.map((line) => `- ${line}`), '']).join('\n').trim()
}

export function siteFactsFromPlan(plan: {
  site?: {
    usda_zone?: unknown
    last_frost?: unknown
    first_frost?: unknown
    lat?: unknown
    lng?: unknown
    surface_type?: unknown
    slope_pct?: unknown
    shade_notes?: unknown
    water_source?: unknown
    constraints_json?: unknown
  } | null
  beds?: SiteBedInput[]
  materials_estimates?: SiteMaterialsInput | null
  harvests?: HarvestInput[] | null
}): SiteFactsInput {
  const site = plan.site || {}
  return {
    usdaZone: site.usda_zone,
    lastFrost: site.last_frost,
    firstFrost: site.first_frost,
    lat: site.lat,
    lng: site.lng,
    surfaceType: site.surface_type,
    slopePct: site.slope_pct,
    shadeNotes: site.shade_notes,
    waterSource: site.water_source,
    constraints: site.constraints_json,
    beds: plan.beds,
    materials: plan.materials_estimates,
    harvests: plan.harvests,
  }
}
