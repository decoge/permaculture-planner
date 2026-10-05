import { withTransaction } from '@/lib/db/pool'
import { asUuid, clampHeight, familyOrOther, surfaceOrSoil, taskCategory, waterOrSpigot } from '@/lib/db/ids'

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

    // Generate the bed ids here rather than reading them back from RETURNING,
    // so the whole set can go in as one statement and the plantings below can
    // still resolve a bed by name.
    const beds = input.beds.map((bed) => ({
      id: asUuid(),
      name: bed.name,
      lengthFt: Math.min(100, Math.max(0.1, bed.lengthFt)),
      widthFt: Math.min(100, Math.max(0.1, bed.widthFt)),
      heightIn: clampHeight(bed.heightIn),
      orientation: bed.orientation === 'EW' ? 'EW' : 'NS',
      surface: surfaceOrSoil(bed.surface),
      wicking: Boolean(bed.wicking),
      trellis: Boolean(bed.trellis),
      pathClearanceIn: bed.pathClearanceIn ?? 18,
      orderIndex: bed.orderIndex,
    }))

    if (beds.length > 0) {
      // One INSERT for the whole plan rather than one per bed: a large site can
      // generate dozens of beds, and this all runs in a single transaction.
      await client.query(
        `INSERT INTO beds (
          plan_id, id, name, shape, length_ft, width_ft, height_in, orientation,
          surface, wicking, trellis, path_clearance_in, order_index
        )
        SELECT $1, t.id, t.name, 'rect'::bed_shape, t.length_ft, t.width_ft, t.height_in,
               t.orientation::orientation, t.surface::surface_type, t.wicking, t.trellis,
               t.path_clearance_in, t.order_index
        FROM unnest(
          $2::uuid[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::text[],
          $8::text[], $9::boolean[], $10::boolean[], $11::numeric[], $12::int[]
        ) AS t(id, name, length_ft, width_ft, height_in, orientation, surface,
               wicking, trellis, path_clearance_in, order_index)`,
        [
          planId,
          beds.map((bed) => bed.id),
          beds.map((bed) => bed.name),
          beds.map((bed) => bed.lengthFt),
          beds.map((bed) => bed.widthFt),
          beds.map((bed) => bed.heightIn),
          beds.map((bed) => bed.orientation),
          beds.map((bed) => bed.surface),
          beds.map((bed) => bed.wicking),
          beds.map((bed) => bed.trellis),
          beds.map((bed) => bed.pathClearanceIn),
          beds.map((bed) => bed.orderIndex),
        ]
      )
    }

    const bedIds = new Map(beds.map((bed) => [bed.name, bed.id]))

    // Plantings whose bedName matches no saved bed are dropped, as before.
    const plantings = input.plantings
      .map((planting) => {
        const bedId = bedIds.get(planting.bedName)
        if (!bedId) return null
        return {
          bedId,
          season: ['spring', 'summer', 'fall', 'winter'].includes(planting.season)
            ? planting.season
            : 'spring',
          year: planting.year,
          variety: planting.variety ?? null,
          spacingIn: planting.spacingIn > 0 ? planting.spacingIn : 12,
          family: familyOrOther(planting.family),
          daysToMaturity: planting.daysToMaturity ?? null,
        }
      })
      .filter((planting): planting is NonNullable<typeof planting> => planting !== null)

    if (plantings.length > 0) {
      await client.query(
        `INSERT INTO plantings (
          bed_id, season, year, variety, spacing_in, family, target_days_to_maturity, sowing_method
        )
        SELECT t.bed_id, t.season::season, t.year, t.variety, t.spacing_in,
               t.family::plant_family, t.days_to_maturity, 'direct'::sowing_method
        FROM unnest(
          $1::uuid[], $2::text[], $3::int[], $4::text[], $5::numeric[],
          $6::text[], $7::int[]
        ) AS t(bed_id, season, year, variety, spacing_in, family, days_to_maturity)`,
        [
          plantings.map((p) => p.bedId),
          plantings.map((p) => p.season),
          plantings.map((p) => p.year),
          plantings.map((p) => p.variety),
          plantings.map((p) => p.spacingIn),
          plantings.map((p) => p.family),
          plantings.map((p) => p.daysToMaturity),
        ]
      )
    }

    const tasks = input.tasks.filter((task) => typeof task.title === 'string' && task.title.trim())
    if (tasks.length > 0) {
      await client.query(
        `INSERT INTO tasks (plan_id, title, category, due_on, completed)
         SELECT $1, t.title, t.category::task_category, t.due::date, false
         FROM unnest($2::text[], $3::text[], $4::text[])
              AS t(title, category, due)`,
        [
          planId,
          tasks.map((task) => task.title.trim()),
          tasks.map((task) => taskCategory(task.category)),
          tasks.map((task) => task.dueOn.slice(0, 10)),
        ]
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
