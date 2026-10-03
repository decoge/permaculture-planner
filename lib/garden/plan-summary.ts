import { PLANT_LIBRARY, PlantInfo } from '@/lib/data/plant-library'

export type SunNeed = 'full' | 'partial' | 'shade'

export interface SummaryPlantInput {
  plantId?: string | null
  name?: string | null
  variety?: string | null
  x?: number | null
  y?: number | null
  spacingIn?: number | null
  spacing_in?: number | string | null
  successions_json?: { position?: { x?: number; y?: number } } | string | null
}

export interface SummaryBedInput {
  id?: string
  name: string
  lengthFt?: number | null
  widthFt?: number | null
  length_ft?: number | string | null
  width_ft?: number | string | null
  width?: number | null
  height?: number | null
  plants?: SummaryPlantInput[]
  plantings?: SummaryPlantInput[]
}

export interface PlantFact {
  name: string
  bedName: string
  sun: SunNeed | null
  spacingIn: number | null
}

export interface SpacingNote {
  bedName: string
  plantA: string
  plantB: string
  apartIn: number
  neededIn: number
  closerThanNeeded: boolean
}

export interface RelationshipNote {
  bedName: string
  plantA: string
  plantB: string
  relation: 'companion' | 'antagonist'
}

export interface BedFact {
  name: string
  lengthFt: number
  widthFt: number
  areaSqFt: number
  plants: PlantFact[]
}

export interface PlanSummary {
  bedCount: number
  plantCount: number
  species: string[]
  areaSqFt: number
  beds: BedFact[]
  sunCounts: Record<SunNeed | 'unknown', number>
  spacingNotes: SpacingNote[]
  relationships: RelationshipNote[]
}

const PIXELS_PER_FOOT = 12

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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

function sunLabel(sun: SunNeed): string {
  switch (sun) {
    case 'full':
      return 'full sun'
    case 'partial':
      return 'partial sun'
    case 'shade':
      return 'shade'
    default: {
      const unexpected: never = sun
      return unexpected
    }
  }
}

function positionOf(plant: SummaryPlantInput): { x: number; y: number } | null {
  if (typeof plant.x === 'number' && typeof plant.y === 'number') {
    return { x: plant.x, y: plant.y }
  }
  const stored = typeof plant.successions_json === 'string'
    ? parseJson(plant.successions_json)
    : plant.successions_json
  const position = stored && typeof stored === 'object' ? stored.position : undefined
  if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') return null
  return { x: position.x, y: position.y }
}

function parseJson(value: string): { position?: { x?: number; y?: number } } | null {
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' ? parsed as { position?: { x?: number; y?: number } } : null
  } catch {
    return null
  }
}

function rawLabel(plant: SummaryPlantInput): string {
  return String(plant.variety || plant.plantId || plant.name || '').trim()
}

function bedSize(bed: SummaryBedInput): { lengthFt: number; widthFt: number } {
  const lengthFt = numberOrNull(bed.lengthFt ?? bed.length_ft)
  const widthFt = numberOrNull(bed.widthFt ?? bed.width_ft)
  if (lengthFt && widthFt && lengthFt > 0 && widthFt > 0) {
    return { lengthFt, widthFt }
  }
  const pixelWidth = numberOrNull(bed.width)
  const pixelHeight = numberOrNull(bed.height)
  return {
    lengthFt: pixelWidth && pixelWidth > 0 ? pixelWidth / PIXELS_PER_FOOT : 0,
    widthFt: pixelHeight && pixelHeight > 0 ? pixelHeight / PIXELS_PER_FOOT : 0,
  }
}

function plantsOn(bed: SummaryBedInput): SummaryPlantInput[] {
  if (bed.plantings && bed.plantings.length > 0) return bed.plantings
  return bed.plants || []
}

function relationBetween(a: PlantInfo, b: PlantInfo): 'companion' | 'antagonist' | null {
  if (a.antagonists.includes(b.id) || b.antagonists.includes(a.id)) return 'antagonist'
  if (a.companions.includes(b.id) || b.companions.includes(a.id)) return 'companion'
  return null
}

interface PlacedPlant extends PlantFact {
  info: PlantInfo | null
  position: { x: number; y: number } | null
}

function placedPlants(bed: SummaryBedInput): PlacedPlant[] {
  return plantsOn(bed).map((plant) => {
    const known = libraryPlant(rawLabel(plant))
    return {
      name: known?.name || titleCase(rawLabel(plant) || 'Plant'),
      bedName: bed.name,
      sun: known?.requirements.sun || null,
      spacingIn: known?.size.spacing ?? null,
      info: known || null,
      position: positionOf(plant),
    }
  })
}

function countSun(plants: PlantFact[]): PlanSummary['sunCounts'] {
  const counts: PlanSummary['sunCounts'] = { full: 0, partial: 0, shade: 0, unknown: 0 }
  for (const plant of plants) {
    if (!plant.sun) {
      counts.unknown += 1
      continue
    }
    switch (plant.sun) {
      case 'full':
      case 'partial':
      case 'shade':
        counts[plant.sun] += 1
        break
      default: {
        const unexpected: never = plant.sun
        return counts
      }
    }
  }
  return counts
}

export function summarizePlan(beds: SummaryBedInput[]): PlanSummary {
  const spacingNotes: SpacingNote[] = []
  const relationships: RelationshipNote[] = []
  const bedFacts: BedFact[] = beds.map((bed) => {
    const size = bedSize(bed)
    const placed = placedPlants(bed)
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const left = placed[i]
        const right = placed[j]
        if (left.info && right.info) {
          const relation = relationBetween(left.info, right.info)
          if (relation) {
            relationships.push({
              bedName: bed.name,
              plantA: left.name,
              plantB: right.name,
              relation,
            })
          }
          if (left.position && right.position) {
            const apartIn = Math.hypot(left.position.x - right.position.x, left.position.y - right.position.y)
            const neededIn = Math.max(left.info.size.spacing, right.info.size.spacing)
            spacingNotes.push({
              bedName: bed.name,
              plantA: left.name,
              plantB: right.name,
              apartIn: Math.round(apartIn),
              neededIn,
              closerThanNeeded: apartIn + 0.5 < neededIn,
            })
          }
        }
      }
    }
    return {
      name: bed.name,
      lengthFt: size.lengthFt,
      widthFt: size.widthFt,
      areaSqFt: size.lengthFt * size.widthFt,
      plants: placed.map(({ name, bedName, sun, spacingIn }) => ({ name, bedName, sun, spacingIn })),
    }
  })

  const plants = bedFacts.flatMap((bed) => bed.plants)
  spacingNotes.sort((a, b) => Number(b.closerThanNeeded) - Number(a.closerThanNeeded))

  return {
    bedCount: bedFacts.length,
    plantCount: plants.length,
    species: [...new Set(plants.map((plant) => plant.name))],
    areaSqFt: bedFacts.reduce((sum, bed) => sum + bed.areaSqFt, 0),
    beds: bedFacts,
    sunCounts: countSun(plants),
    spacingNotes,
    relationships,
  }
}

export function formatFeet(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatPlanSummary(input: {
  planName: string
  siteName?: string | null
  usdaZone?: string | null
  summary: PlanSummary
}): string {
  const { planName, siteName, usdaZone, summary } = input
  const lines: string[] = [planName]
  if (siteName) lines.push(`Site: ${siteName}`)
  if (usdaZone) lines.push(`USDA zone: ${usdaZone}`)
  lines.push(
    '',
    `${summary.bedCount} beds, ${formatFeet(summary.areaSqFt)} sq ft, ${summary.plantCount} plantings, ${summary.species.length} species.`,
    '',
    'Beds',
  )

  if (summary.beds.length === 0) {
    lines.push('No beds are saved on this plan.')
  }

  for (const bed of summary.beds) {
    lines.push(`- ${bed.name}: ${formatFeet(bed.lengthFt)} ft × ${formatFeet(bed.widthFt)} ft`)
    if (bed.plants.length === 0) {
      lines.push('  No plants saved in this bed.')
      continue
    }
    for (const plant of bed.plants) {
      const sun = plant.sun ? sunLabel(plant.sun) : 'sun not recorded'
      const spacing = plant.spacingIn ? `${plant.spacingIn} in spacing` : 'spacing not recorded'
      lines.push(`  - ${plant.name}: ${sun}, ${spacing}`)
    }
  }

  lines.push('', 'Sun')
  lines.push(`- Full sun: ${summary.sunCounts.full}`)
  lines.push(`- Partial sun: ${summary.sunCounts.partial}`)
  lines.push(`- Shade: ${summary.sunCounts.shade}`)
  if (summary.sunCounts.unknown > 0) {
    lines.push(`- Sun not recorded: ${summary.sunCounts.unknown}`)
  }

  lines.push('', 'Spacing')
  if (summary.spacingNotes.length === 0) {
    lines.push('Saved plant positions are not close enough to compare, or the plants are not in the library.')
  }
  for (const note of summary.spacingNotes) {
    const fit = note.closerThanNeeded
      ? `closer than the ${note.neededIn} in these plants need`
      : `at least the ${note.neededIn} in these plants need`
    lines.push(`- ${note.plantA} and ${note.plantB} in ${note.bedName} are ${note.apartIn} in apart, ${fit}.`)
  }

  lines.push('', 'Permaculture ethics')
  const companions = summary.relationships.filter((note) => note.relation === 'companion')
  const antagonists = summary.relationships.filter((note) => note.relation === 'antagonist')
  lines.push(
    `Earth care: ${summary.species.length} species across ${summary.bedCount} beds.`
    + (companions.length
      ? ` Companion pairs: ${companions.map((note) => `${note.plantA} with ${note.plantB} in ${note.bedName}`).join('; ')}.`
      : ' No companion pairs from the plant library share a bed.')
    + (antagonists.length
      ? ` Antagonist pairs: ${antagonists.map((note) => `${note.plantA} with ${note.plantB} in ${note.bedName}`).join('; ')}.`
      : ' No antagonist pairs share a bed.'),
  )
  lines.push(
    summary.plantCount > 0
      ? `People care: the plan grows ${summary.species.join(', ')}.`
      : 'People care: no plants are saved on this plan.',
  )
  lines.push('Fair share: this plan does not record shared harvest, seed saving, or community use.')
  lines.push('', 'Counted from the saved beds and plantings. This is not a soil test or a design score.')
  return lines.join('\n')
}

export { sunLabel }
