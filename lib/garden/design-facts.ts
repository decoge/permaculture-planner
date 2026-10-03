import { PLANT_LIBRARY, PlantInfo } from '@/lib/data/plant-library'
import {
  HarvestInput,
  SiteBedInput,
  SiteFactsInput,
  SitePlantInput,
} from '@/lib/garden/site-facts'

export interface DesignFacts {
  companions: string[]
  relationships: string[]
  evolution: string[]
  implementation: string[]
  critique: string[]
  progress: string[]
  knowledge: string[]
  templates: string[]
  analytics: string[]
  permaculture: string[]
}

type WaterSource = 'spigot' | 'rain' | 'none' | 'drip'
type Season = 'spring' | 'summer' | 'fall' | 'winter'

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

function recordedDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const text = recordedText(value)
  return text ? text.slice(0, 10) : null
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

function plantsOn(bed: SiteBedInput): SitePlantInput[] {
  if (bed.plantings && bed.plantings.length > 0) return bed.plantings
  return bed.plants || []
}

function libraryInfo(plant: SitePlantInput): PlantInfo | null {
  const raw = String(plant.variety || plant.plantId || plant.name || '').trim().toLowerCase()
  if (!raw) return null
  return PLANT_LIBRARY.find((item) => item.id === raw || item.name.toLowerCase() === raw) || null
}

function plantName(plant: SitePlantInput): string | null {
  const raw = String(plant.variety || plant.plantId || plant.name || '').trim()
  if (!raw) return null
  return libraryInfo(plant)?.name || titleCase(raw)
}

function libraryCompanions(left: PlantInfo, right: PlantInfo): boolean {
  return left.companions.includes(right.id) || right.companions.includes(left.id)
}

function bedName(bed: SiteBedInput): string {
  return recordedText(bed.name) || 'Bed'
}

function namedPlants(bed: SiteBedInput): string[] {
  return plantsOn(bed).flatMap((plant) => {
    const name = plantName(plant)
    return name ? [name] : []
  })
}

function listPhrase(names: string[]): string {
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

function whenPlanted(plant: SitePlantInput): string | null {
  const seasonText = recordedText(plant.season)
  if (!seasonText) return null
  const season = isSeason(seasonText) ? seasonLabel(seasonText) : seasonText
  const year = recordedNumber(plant.year)
  return year === null ? season : `${season} ${formatQuantity(year)}`
}

function knowledgeNote(value: unknown): string | null {
  const direct = recordedText(value)
  if (direct && !direct.startsWith('{') && !direct.startsWith('[')) return direct
  const record = asRecord(value)
  if (!record) return null
  return recordedText(record.note) || recordedText(record.text) || recordedText(record.knowledge)
}

function constraintsOf(input: SiteFactsInput): Record<string, unknown> | null {
  return asRecord(input.constraints)
}

function savedArea(input: SiteFactsInput): { total: number | null, usable: number | null } {
  const area = asRecord(constraintsOf(input)?.area)
  return {
    total: recordedNumber(area?.total_sqft ?? area?.totalSqft),
    usable: recordedNumber(area?.usable_fraction ?? area?.usableFraction),
  }
}

function weeklyMinutes(input: SiteFactsInput): number | null {
  const crops = asRecord(constraintsOf(input)?.crops)
  return recordedNumber(crops?.time_weekly_minutes ?? crops?.timeWeeklyMinutes)
}

function waterLabel(input: SiteFactsInput): string | null {
  const constraints = constraintsOf(input)
  const water = asRecord(constraints?.water)
  const raw = recordedText(input.waterSource) || recordedText(water?.source)
  if (!raw) return null
  return isWaterSource(raw) ? waterSourceLabel(raw) : raw
}

function companionLines(beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  if (beds.length === 0) lines.push('No beds are saved.')
  let anyPlants = false
  let anyPair = false
  for (const bed of beds) {
    const name = bedName(bed)
    const plants = plantsOn(bed).flatMap((plant) => {
      const label = plantName(plant)
      return label ? [{ label, info: libraryInfo(plant) }] : []
    })
    if (plants.length === 0) {
      lines.push(`${name} has no plants saved.`)
      continue
    }
    anyPlants = true
    lines.push(`${name} has ${listPhrase(plants.map((plant) => plant.label))} saved in the same bed.`)
    let bedPairs = 0
    for (let i = 0; i < plants.length; i += 1) {
      for (let j = i + 1; j < plants.length; j += 1) {
        const left = plants[i]
        const right = plants[j]
        if (!left.info || !right.info || !libraryCompanions(left.info, right.info)) continue
        bedPairs += 1
        anyPair = true
        lines.push(`From the plant library, ${left.label} with ${right.label} in ${name}.`)
      }
    }
    if (bedPairs === 0) {
      lines.push(`No companion pair from the plant library is recorded for ${name}.`)
    }
  }
  if (!anyPlants) lines.push('No plants are saved.')
  if (!anyPair) lines.push('No companion pairs from the plant library share a bed.')
  return lines
}

function relationshipLines(beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  if (beds.length === 0) lines.push('No beds are saved.')
  const planted = beds.filter((bed) => namedPlants(bed).length > 0)
  if (planted.length === 0) lines.push('No plants are saved.')
  for (const bed of planted) {
    lines.push(`${bedName(bed)} records ${listPhrase(namedPlants(bed))} in one bed.`)
  }
  if (beds.length > 1) {
    lines.push(`No link between ${listPhrase(beds.map(bedName))} is recorded.`)
  }
  lines.push('Guilds, energy flows, and nutrient cycles are not recorded.')
  return lines
}

function evolutionLines(beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  const plantings = beds.flatMap((bed) => plantsOn(bed).map((plant) => ({ bed, plant })))
  if (plantings.length === 0) {
    lines.push('No plants are saved.')
    lines.push('Planting season is not recorded.')
  }
  for (const { bed, plant } of plantings) {
    const name = plantName(plant)
    if (!name) continue
    const when = whenPlanted(plant)
    lines.push(when
      ? `${name} in ${bedName(bed)} is recorded for ${when}.`
      : `${name} in ${bedName(bed)}: planting season is not recorded.`)
  }
  lines.push('A multi-year timeline is not recorded.')
  lines.push('Yields are not recorded.')
  lines.push('Milestones are not recorded.')
  return lines
}

function implementationLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  if (beds.length === 0) lines.push('No beds are saved.')
  for (const bed of beds) lines.push(`${bedName(bed)} is saved on this plan.`)
  const minutes = weeklyMinutes(input)
  lines.push(minutes === null
    ? 'Weekly garden time is not recorded.'
    : `Weekly garden time is recorded as ${formatQuantity(minutes)} minutes.`)
  const cost = recordedNumber(input.materials?.costEstimateCents ?? input.materials?.cost_estimate_cents)
  lines.push(cost === null ? 'Cost is not recorded.' : `Cost is recorded as ${formatQuantity(cost)} cents.`)
  lines.push('Implementation phases are not recorded.')
  lines.push('A phase schedule is not recorded.')
  return lines
}

function critiqueLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines = ['A design score is not recorded.', 'No critique notes are recorded.']
  const usda = recordedText(input.usdaZone)
  lines.push(usda ? `USDA zone is recorded as ${usda}.` : 'USDA zone is not recorded.')
  const lastFrost = recordedDate(input.lastFrost)
  const firstFrost = recordedDate(input.firstFrost)
  lines.push(lastFrost ? `Last frost is recorded as ${lastFrost}.` : 'Last frost is not recorded.')
  lines.push(firstFrost ? `First frost is recorded as ${firstFrost}.` : 'First frost is not recorded.')
  const missingZone = beds.some((bed) => {
    const notes = asRecord(bed.notes)
    return recordedNumber(bed.zone) === null && recordedText(bed.zone) === null
      && recordedNumber(notes?.zone) === null && recordedText(notes?.zone) === null
  })
  if (beds.length === 0 || missingZone) lines.push('A permaculture zone is not recorded.')
  return lines
}

function imageCount(value: unknown): number {
  return Array.isArray(value) ? value.filter((item) => recordedText(item)).length : 0
}

function progressLines(input: SiteFactsInput): string[] {
  const lines: string[] = []
  const journal = input.journal || []
  if (journal.length === 0) {
    lines.push('No journal entries are recorded.')
    lines.push('Photos are not recorded.')
  }
  let photos = 0
  for (const entry of journal) {
    const title = recordedText(entry.title) || 'Journal entry'
    const when = recordedDate(entry.createdAt ?? entry.created_at)
    lines.push(when ? `${title} is recorded on ${when}.` : `${title} is recorded.`)
    const content = recordedText(entry.content)
    if (content) lines.push(content)
    photos += imageCount(entry.images)
  }
  if (journal.length > 0) {
    lines.push(photos === 0 ? 'Photos are not recorded.' : `${formatQuantity(photos)} photos are recorded.`)
  }
  const harvests = input.harvests || []
  if (harvests.length === 0) lines.push('No harvests are recorded.')
  for (const harvest of harvests) lines.push(harvestLine(harvest))
  const tasks = input.tasks || []
  lines.push(tasks.length === 0
    ? 'No tasks are recorded.'
    : tasks.length === 1
      ? '1 task is recorded.'
      : `${formatQuantity(tasks.length)} tasks are recorded.`)
  const recordedYield = harvests.some((harvest) => recordedNumber(harvest.quantity) !== null)
  if (!recordedYield) lines.push('Yields are not recorded.')
  return lines
}

function harvestLine(harvest: HarvestInput): string {
  const raw = recordedText(harvest.variety)
  const known = raw
    ? PLANT_LIBRARY.find((item) => item.id === raw.toLowerCase() || item.name.toLowerCase() === raw.toLowerCase())
    : undefined
  const variety = known?.name || raw || 'A harvest'
  const quantity = recordedNumber(harvest.quantity)
  const unit = recordedText(harvest.unit)
  const when = recordedDate(harvest.harvestedOn ?? harvest.harvested_on)
  const amount = quantity === null ? 'quantity not recorded' : `${formatQuantity(quantity)}${unit ? ` ${unit}` : ''}`
  return when
    ? `${variety} harvest is recorded as ${amount} on ${when}.`
    : `${variety} harvest is recorded as ${amount}.`
}

function knowledgeLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  const shade = recordedText(input.shadeNotes)
  lines.push(shade ? `Shade notes: ${shade}` : 'Shade notes are not recorded.')
  let anyNote = Boolean(shade)
  for (const bed of beds) {
    const note = knowledgeNote(bed.notes)
    if (note) {
      anyNote = true
      lines.push(`${bedName(bed)} note: ${note}`)
    }
    for (const plant of plantsOn(bed)) {
      const name = plantName(plant)
      const plantNote = knowledgeNote(plant.notes)
      if (name && plantNote) {
        anyNote = true
        lines.push(`${name} in ${bedName(bed)} note: ${plantNote}`)
      }
    }
  }
  for (const entry of input.journal || []) {
    const content = recordedText(entry.content)
    if (!content) continue
    anyNote = true
    const title = recordedText(entry.title) || 'Journal entry'
    lines.push(`${title}: ${content}`)
  }
  if (!anyNote) lines.push('Knowledge notes are not recorded.')
  lines.push('A guide library is not saved on this plan.')
  return lines
}

function templateLines(input: SiteFactsInput): string[] {
  const constraints = constraintsOf(input)
  const saved = recordedText(input.template) || recordedText(constraints?.template)
  return [
    saved ? `A template is saved: ${saved}.` : 'No template is saved on this plan.',
    'A pattern library is not saved on this plan.',
  ]
}

function analyticsLines(input: SiteFactsInput, beds: SiteBedInput[]): string[] {
  const lines: string[] = []
  const area = savedArea(input)
  lines.push(area.total === null
    ? 'Site area is not recorded.'
    : `Site area is recorded as ${formatQuantity(area.total)} sq ft.`)
  lines.push(area.usable === null
    ? 'Usable fraction is not recorded.'
    : `Usable fraction is recorded as ${formatQuantity(area.usable)}.`)
  if (beds.length === 0) lines.push('No beds are saved.')
  let plants = 0
  for (const bed of beds) {
    const name = bedName(bed)
    const length = recordedNumber(bed.lengthFt ?? bed.length_ft)
    const width = recordedNumber(bed.widthFt ?? bed.width_ft)
    const savedPlants = namedPlants(bed)
    plants += savedPlants.length
    if (length === null || width === null) {
      lines.push(`${name} length or width is not recorded.`)
    } else {
      lines.push(`${name} is recorded as ${formatQuantity(length)} ft by ${formatQuantity(width)} ft.`)
    }
    lines.push(savedPlants.length === 0
      ? `${name} has no plants saved.`
      : `${name} has ${formatQuantity(savedPlants.length)} plants saved.`)
  }
  lines.push(plants === 0 ? 'No plants are saved.' : `${formatQuantity(plants)} plants are saved.`)
  const minutes = weeklyMinutes(input)
  lines.push(minutes === null
    ? 'Weekly garden time is not recorded.'
    : `Weekly garden time is recorded as ${formatQuantity(minutes)} minutes.`)
  const recordedYield = (input.harvests || []).some((harvest) => recordedNumber(harvest.quantity) !== null)
  lines.push(recordedYield ? 'Harvest quantities are recorded.' : 'Yields are not recorded.')
  lines.push('A performance score is not recorded.')
  return lines
}

function permacultureLines(input: SiteFactsInput): string[] {
  const lines: string[] = []
  const usda = recordedText(input.usdaZone)
  lines.push(usda ? `USDA zone is recorded as ${usda}.` : 'USDA zone is not recorded.')
  const water = waterLabel(input)
  lines.push(water ? `Water source is recorded as ${water}.` : 'Water source is not recorded.')
  lines.push('A permaculture principle score is not recorded.')
  lines.push('Ethics scores are not recorded.')
  return lines
}

export function summarizeDesignFacts(input: SiteFactsInput): DesignFacts {
  const beds = input.beds || []
  return {
    companions: companionLines(beds),
    relationships: relationshipLines(beds),
    evolution: evolutionLines(beds),
    implementation: implementationLines(input, beds),
    critique: critiqueLines(input, beds),
    progress: progressLines(input),
    knowledge: knowledgeLines(input, beds),
    templates: templateLines(input),
    analytics: analyticsLines(input, beds),
    permaculture: permacultureLines(input),
  }
}

export function formatDesignFacts(facts: DesignFacts): string {
  const sections: Array<[string, string[]]> = [
    ['Companions', facts.companions],
    ['Relationships', facts.relationships],
    ['Evolution', facts.evolution],
    ['Implementation', facts.implementation],
    ['Critique', facts.critique],
    ['Progress', facts.progress],
    ['Knowledge', facts.knowledge],
    ['Templates', facts.templates],
    ['Analytics', facts.analytics],
    ['Permaculture', facts.permaculture],
  ]
  return sections.flatMap(([title, lines]) => [title, ...lines.map((line) => `- ${line}`), '']).join('\n').trim()
}
