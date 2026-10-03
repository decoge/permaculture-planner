import { withTransaction } from '@/lib/db/pool'
import { clampHeight, familyOrOther, surfaceOrSoil, taskCategory, waterOrSpigot } from '@/lib/db/ids'

export interface WizardSiteInput {
  name: string
  lat?: number | null
  lng?: number | null
  usdaZone?: string | null
  lastFrost?: string | null
  firstFrost?: string | null
  surfaceType?: string | null
  slope?: number | null
  shadeNotes?: string | null
  waterSource?: string | null
  constraints?: unknown
}

export interface WizardBedInput {
  name: string
  lengthFt: number
  widthFt: number
  heightIn: number
  orientation: 'NS' | 'EW'
  surface?: string | null
  wicking?: boolean
  trellis?: boolean
  pathClearanceIn?: number
  orderIndex: number
}

export interface WizardPlantingInput {
  bedName: string
  season: string
  year: number
  variety?: string | null
  spacingIn: number
  family?: string | null
  daysToMaturity?: number | null
}

export interface WizardTaskInput {
  title: string
  dueOn: string
  category: string
}

export interface WizardMaterialsInput {
  soilCuft: number
  compostCuft: number
  mulchCuft: number
  lumberBoardFeet: number
  screws: number
  dripLineFt: number
  emitters: number
  rowCoverSqFt: number
  costCents: number
}

export async function createWizardPlan(input: {
  userId: string
  site: WizardSiteInput
  planName: string
  beds: WizardBedInput[]
  plantings: WizardPlantingInput[]
  tasks: WizardTaskInput[]
  materials: WizardMaterialsInput
}) {
  return withTransaction(async (client) => {
    const site = await client.query<{ id: string }>(
      `INSERT INTO sites (
        user_id, name, lat, lng, country_code, usda_zone, last_frost, first_frost,
        surface_type, slope_pct, shade_notes, water_source, constraints_json
      ) VALUES (
        $1, $2, $3, $4, 'US', $5, $6, $7, $8::surface_type, $9, $10, $11::water_source, $12::jsonb
      ) RETURNING id`,
      [
        input.userId,
        input.site.name,
        input.site.lat ?? null,
        input.site.lng ?? null,
        input.site.usdaZone ?? null,
        input.site.lastFrost ?? null,
        input.site.firstFrost ?? null,
        surfaceOrSoil(input.site.surfaceType),
        input.site.slope ?? null,
        input.site.shadeNotes ?? null,
        waterOrSpigot(input.site.waterSource),
        JSON.stringify(input.site.constraints ?? {}),
      ]
    )
    const siteId = site.rows[0].id

    const plan = await client.query<{ id: string }>(
      `INSERT INTO plans (site_id, name, version, status)
       VALUES ($1, $2, 1, 'draft')
       RETURNING id`,
      [siteId, input.planName]
    )
    const planId = plan.rows[0].id

    const bedIds = new Map<string, string>()
    for (const bed of input.beds) {
      const inserted = await client.query<{ id: string; name: string }>(
        `INSERT INTO beds (
          plan_id, name, shape, length_ft, width_ft, height_in, orientation,
          surface, wicking, trellis, path_clearance_in, order_index
        ) VALUES (
          $1, $2, 'rect', $3, $4, $5, $6::orientation,
          $7::surface_type, $8, $9, $10, $11
        ) RETURNING id, name`,
        [
          planId,
          bed.name,
          Math.min(100, Math.max(0.1, bed.lengthFt)),
          Math.min(100, Math.max(0.1, bed.widthFt)),
          clampHeight(bed.heightIn),
          bed.orientation === 'EW' ? 'EW' : 'NS',
          surfaceOrSoil(bed.surface),
          Boolean(bed.wicking),
          Boolean(bed.trellis),
          bed.pathClearanceIn ?? 18,
          bed.orderIndex,
        ]
      )
      bedIds.set(inserted.rows[0].name, inserted.rows[0].id)
    }

    for (const planting of input.plantings) {
      const bedId = bedIds.get(planting.bedName)
      if (!bedId) continue
      const season = ['spring', 'summer', 'fall', 'winter'].includes(planting.season)
        ? planting.season
        : 'spring'
      await client.query(
        `INSERT INTO plantings (
          bed_id, season, year, variety, spacing_in, family, target_days_to_maturity, sowing_method
        ) VALUES ($1, $2::season, $3, $4, $5, $6::plant_family, $7, 'direct')`,
        [
          bedId,
          season,
          planting.year,
          planting.variety ?? null,
          planting.spacingIn > 0 ? planting.spacingIn : 12,
          familyOrOther(planting.family),
          planting.daysToMaturity ?? null,
        ]
      )
    }

    for (const task of input.tasks) {
      await client.query(
        `INSERT INTO tasks (plan_id, title, category, due_on, completed)
         VALUES ($1, $2, $3::task_category, $4, false)`,
        [planId, task.title, taskCategory(task.category), task.dueOn.slice(0, 10)]
      )
    }

    const materials = input.materials
    await client.query(
      `INSERT INTO materials_estimates (
        plan_id, soil_cuft, compost_cuft, mulch_cuft, lumber_boardfeet, screws_count,
        drip_line_ft, emitters_count, row_cover_sqft, cost_estimate_cents
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        planId,
        materials.soilCuft,
        materials.compostCuft,
        materials.mulchCuft,
        materials.lumberBoardFeet,
        materials.screws,
        materials.dripLineFt,
        materials.emitters,
        materials.rowCoverSqFt,
        materials.costCents,
      ]
    )

    return { id: planId, siteId }
  })
}
