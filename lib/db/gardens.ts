import type { PoolClient } from 'pg'
import { query, queryOne, withTransaction } from '@/lib/db/pool'
import {
  asUuid,
  clampHeight,
  currentSeason,
  familyOrOther,
  positiveFeet,
  surfaceOrSoil,
  waterOrSpigot,
} from '@/lib/db/ids'

export interface CanvasPlantInput {
  id?: string
  plantId?: string
  x?: number
  y?: number
  plantedDate?: string | Date | null
}

export interface CanvasBedInput {
  id?: string
  name?: string
  points?: { x: number; y: number }[]
  fill?: string
  stroke?: string
  plants?: CanvasPlantInput[]
  width?: number
  height?: number
  rotation?: number
  elementType?: string
  elementCategory?: string
  zone?: number
  metadata?: Record<string, unknown>
}

interface OwnedPlan {
  id: string
  site_id: string
  name: string
  version: number
  status: string
  scene_json: unknown
  meta: Record<string, unknown> | null
  created_at: Date | string
  updated_at: Date | string
  user_id: string
  site_name: string
  constraints_json: Record<string, unknown> | null
  lat: number | null
  lng: number | null
  country_code: string | null
  usda_zone: string | null
  last_frost: Date | string | null
  first_frost: Date | string | null
  surface_type: string
  slope_pct: number | null
  shade_notes: string | null
  water_source: string | null
}

function bounds(points: { x: number; y: number }[] | undefined) {
  if (!points || points.length === 0) return { width: 48, height: 48, x: 0, y: 0 }
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY), x: minX, y: minY }
}

function bedRow(bed: CanvasBedInput, planId: string, index: number) {
  const box = bounds(bed.points)
  const lengthFt = positiveFeet((bed.width || box.width || 48) / 12)
  const widthFt = positiveFeet((bed.height || box.height || 48) / 12)
  const rotation = bed.rotation || 0
  const orientation = rotation === 90 || rotation === 270 ? 'EW' : 'NS'
  const origin = bed.points && bed.points.length > 0 ? bed.points[0] : { x: box.x, y: box.y }

  return {
    id: asUuid(bed.id),
    planId,
    name: bed.name || `Bed ${index + 1}`,
    lengthFt,
    widthFt,
    heightIn: clampHeight(12),
    orientation,
    notes: JSON.stringify({
      points: bed.points || [],
      fill: bed.fill || '#e0f2e0',
      stroke: bed.stroke || '#22c55e',
      elementType: bed.elementType,
      elementCategory: bed.elementCategory,
      zone: bed.zone,
      metadata: bed.metadata,
      width: bed.width,
      height: bed.height,
    }),
    orderIndex: index,
    position: { x: origin.x || 0, y: origin.y || 0, rotation },
    plants: bed.plants || [],
  }
}

async function replaceBeds(client: PoolClient, planId: string, beds: CanvasBedInput[]) {
  await client.query('DELETE FROM beds WHERE plan_id = $1', [planId])

  for (let index = 0; index < beds.length; index += 1) {
    const bed = beds[index]
    const row = bedRow(bed, planId, index)
    await client.query(
      `INSERT INTO beds (
        id, plan_id, name, shape, length_ft, width_ft, height_in, orientation,
        surface, wicking, trellis, path_clearance_in, notes, order_index, position_json
      ) VALUES (
        $1, $2, $3, 'rect', $4, $5, $6, $7,
        'soil', false, false, 24, $8, $9, $10::jsonb
      )`,
      [
        row.id,
        row.planId,
        row.name,
        row.lengthFt,
        row.widthFt,
        row.heightIn,
        row.orientation,
        row.notes,
        row.orderIndex,
        JSON.stringify(row.position),
      ]
    )

    for (const plant of row.plants) {
      const planted = plant.plantedDate ? new Date(plant.plantedDate) : null
      const sowDate = planted && !Number.isNaN(planted.getTime()) ? planted.toISOString().slice(0, 10) : null
      await client.query(
        `INSERT INTO plantings (
          id, bed_id, season, year, crop_id, variety, spacing_in, family,
          target_days_to_maturity, sowing_method, sow_date, notes, successions_json
        ) VALUES (
          $1, $2, $3, $4, NULL, $5, 12, $6,
          70, 'direct', $7, $8, $9::jsonb
        )`,
        [
          asUuid(plant.id),
          row.id,
          currentSeason(),
          new Date().getFullYear(),
          plant.plantId || null,
          familyOrOther('Other'),
          sowDate,
          'Planted via canvas editor',
          JSON.stringify({ position: { x: plant.x ?? 24, y: plant.y ?? 24 } }),
        ]
      )
    }
  }
}

async function ownedPlan(userId: string, planId: string): Promise<OwnedPlan | null> {
  return queryOne<OwnedPlan>(
    `SELECT p.id, p.site_id, p.name, p.version, p.status, p.scene_json, p.meta,
            p.created_at, p.updated_at,
            s.user_id, s.name AS site_name, s.constraints_json, s.lat, s.lng,
            s.country_code, s.usda_zone, s.last_frost, s.first_frost,
            s.surface_type, s.slope_pct, s.shade_notes, s.water_source
     FROM plans p
     JOIN sites s ON s.id = p.site_id
     WHERE p.id = $1 AND s.user_id = $2`,
    [planId, userId]
  )
}

function textField(source: Record<string, unknown> | undefined, key: string): string | null {
  const value = source?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function numberField(source: Record<string, unknown> | undefined, key: string): number | null {
  const value = source?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function saveGarden(
  userId: string,
  input: {
    beds: CanvasBedInput[]
    metadata?: Record<string, unknown>
    siteData?: Record<string, unknown>
    planData?: Record<string, unknown>
  }
) {
  return withTransaction(async (client) => {
    const siteData = input.siteData || {}
    const planData = input.planData || {}
    let siteId = typeof siteData.id === 'string' ? siteData.id : null

    const constraints = {
      ...(typeof siteData.constraints_json === 'object' && siteData.constraints_json
        ? (siteData.constraints_json as Record<string, unknown>)
        : {}),
      canvas: input.metadata || {},
    }

    if (siteId) {
      const owned = await client.query('SELECT id FROM sites WHERE id = $1 AND user_id = $2', [siteId, userId])
      if (!owned.rowCount) {
        const error = new Error('Site not found')
        ;(error as Error & { status?: number }).status = 404
        throw error
      }
      await client.query(
        `UPDATE sites SET
          name = COALESCE($3, name),
          surface_type = COALESCE($4::surface_type, surface_type),
          water_source = COALESCE($5::water_source, water_source),
          lat = COALESCE($6, lat),
          lng = COALESCE($7, lng),
          usda_zone = COALESCE($8, usda_zone),
          last_frost = COALESCE($9, last_frost),
          first_frost = COALESCE($10, first_frost),
          slope_pct = COALESCE($11, slope_pct),
          shade_notes = COALESCE($12, shade_notes),
          constraints_json = $13::jsonb
         WHERE id = $1 AND user_id = $2`,
        [
          siteId,
          userId,
          textField(siteData, 'name'),
          siteData.surface_type ? surfaceOrSoil(siteData.surface_type) : null,
          siteData.water_source ? waterOrSpigot(siteData.water_source) : null,
          numberField(siteData, 'lat'),
          numberField(siteData, 'lng'),
          textField(siteData, 'usda_zone'),
          textField(siteData, 'last_frost'),
          textField(siteData, 'first_frost'),
          numberField(siteData, 'slope_pct'),
          textField(siteData, 'shade_notes'),
          JSON.stringify(constraints),
        ]
      )
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO sites (
          user_id, name, lat, lng, country_code, usda_zone, last_frost, first_frost,
          surface_type, slope_pct, shade_notes, water_source, constraints_json
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::surface_type, $10, $11, $12::water_source, $13::jsonb
        ) RETURNING id`,
        [
          userId,
          textField(siteData, 'name') || `Garden Site - ${new Date().toLocaleDateString()}`,
          numberField(siteData, 'lat'),
          numberField(siteData, 'lng'),
          textField(siteData, 'country_code'),
          textField(siteData, 'usda_zone'),
          textField(siteData, 'last_frost'),
          textField(siteData, 'first_frost'),
          surfaceOrSoil(siteData.surface_type),
          numberField(siteData, 'slope_pct'),
          textField(siteData, 'shade_notes'),
          waterOrSpigot(siteData.water_source),
          JSON.stringify(constraints),
        ]
      )
      siteId = inserted.rows[0].id
    }

    let planId = typeof planData.id === 'string' ? planData.id : null
    const planName = textField(planData, 'name') || `Garden Plan - ${new Date().toLocaleDateString()}`
    const planStatus = textField(planData, 'status') || 'draft'

    if (planId) {
      const owned = await client.query(
        `SELECT p.id FROM plans p JOIN sites s ON s.id = p.site_id
         WHERE p.id = $1 AND s.user_id = $2`,
        [planId, userId]
      )
      if (!owned.rowCount) {
        const error = new Error('Plan not found')
        ;(error as Error & { status?: number }).status = 404
        throw error
      }
      await client.query(
        `UPDATE plans
         SET name = $2, status = $3::plan_status, meta = meta || $4::jsonb
         WHERE id = $1`,
        [planId, planName, planStatus, JSON.stringify({ canvas: input.metadata || {} })]
      )
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO plans (site_id, name, version, status, meta)
         VALUES ($1, $2, 1, $3::plan_status, $4::jsonb)
         RETURNING id`,
        [siteId, planName, planStatus, JSON.stringify({ canvas: input.metadata || {} })]
      )
      planId = inserted.rows[0].id
    }

    if (!siteId || !planId) {
      throw new Error('Failed to save garden')
    }
    await replaceBeds(client, planId, input.beds || [])
    return { siteId, planId }
  })
}

export async function updateGarden(
  userId: string,
  planId: string,
  beds: CanvasBedInput[],
  metadata?: Record<string, unknown>,
  planName?: string
) {
  return withTransaction(async (client) => {
    const plan = await client.query<OwnedPlan>(
      `SELECT p.id, p.site_id, p.name, p.version, s.constraints_json
       FROM plans p
       JOIN sites s ON s.id = p.site_id
       WHERE p.id = $1 AND s.user_id = $2`,
      [planId, userId]
    )
    if (!plan.rowCount) return null

    const current = plan.rows[0]
    const constraints = {
      ...(current.constraints_json || {}),
      canvas: metadata || {},
      updated_at: new Date().toISOString(),
    }

    // Only bump the name when a non-empty one was supplied, so a bed-only save
    // never blanks an existing plan name.
    await client.query(
      `UPDATE plans
       SET version = version + 1,
           name = COALESCE(NULLIF($3, ''), name),
           meta = meta || $2::jsonb
       WHERE id = $1`,
      [planId, JSON.stringify({ canvas: metadata || {} }), planName ?? '']
    )
    await client.query('UPDATE sites SET constraints_json = $2::jsonb WHERE id = $1', [
      current.site_id,
      JSON.stringify(constraints),
    ])
    await replaceBeds(client, planId, beds)
    return { planId, siteId: current.site_id }
  })
}

export async function deleteGarden(userId: string, planId: string): Promise<boolean> {
  const deleted = await query(
    `DELETE FROM plans p
     USING sites s
     WHERE p.id = $1 AND p.site_id = s.id AND s.user_id = $2
     RETURNING p.id`,
    [planId, userId]
  )
  return deleted.length > 0
}

export async function userOwnsPlan(userId: string, planId: string): Promise<boolean> {
  const plan = await ownedPlan(userId, planId)
  return Boolean(plan)
}

export async function listGardens(userId: string) {
  return query(
    `SELECT p.id, p.name, p.status, p.created_at, p.updated_at,
            s.name AS site_name,
            (SELECT COUNT(*)::int FROM beds b WHERE b.plan_id = p.id) AS bed_count,
            (SELECT COUNT(*)::int FROM plantings pl
              JOIN beds b ON b.id = pl.bed_id
              WHERE b.plan_id = p.id) AS plant_count
     FROM plans p
     JOIN sites s ON s.id = p.site_id
     WHERE s.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  )
}

export async function listDashboardPlans(userId: string) {
  const plans = await query<Record<string, unknown>>(
    `SELECT p.*, s.name AS site_name
     FROM plans p
     JOIN sites s ON s.id = p.site_id
     WHERE s.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  )

  const detailed = []
  for (const plan of plans) {
    const site = await queryOne(
      'SELECT * FROM sites WHERE id = $1',
      [plan.site_id as string]
    )
    const beds = await query(
      'SELECT * FROM beds WHERE plan_id = $1 ORDER BY order_index',
      [plan.id as string]
    )
    const materials = await queryOne(
      `SELECT * FROM materials_estimates
       WHERE plan_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [plan.id as string]
    )
    const totalArea = beds.reduce((sum, bed) => {
      const length = Number(bed.length_ft) || 0
      const width = Number(bed.width_ft) || 0
      return sum + length * width
    }, 0)
    const plantingStats = await queryOne<{ plants: number; varieties: number }>(
      `SELECT COUNT(pl.id)::int AS plants,
              COUNT(DISTINCT pl.variety)::int AS varieties
       FROM plantings pl
       JOIN beds b ON b.id = pl.bed_id
       WHERE b.plan_id = $1`,
      [plan.id as string]
    )
    detailed.push({
      ...plan,
      site,
      beds,
      materials_estimates: materials,
      stats: {
        plants: plantingStats?.plants || 0,
        varieties: plantingStats?.varieties || 0,
        area: totalArea,
        beds: beds.length,
      },
    })
  }
  return detailed
}

export async function getPlanDetail(userId: string, planId: string) {
  const plan = await ownedPlan(userId, planId)
  if (!plan) return null

  const beds = await query<Record<string, unknown>>(
    'SELECT * FROM beds WHERE plan_id = $1 ORDER BY order_index',
    [planId]
  )
  const bedIds = beds.map((bed) => bed.id as string)
  const plantings = bedIds.length
    ? await query('SELECT * FROM plantings WHERE bed_id = ANY($1::uuid[])', [bedIds])
    : []
  const materials = await queryOne(
    `SELECT * FROM materials_estimates WHERE plan_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [planId]
  )
  const harvests = await query(
    `SELECT h.quantity, h.unit, h.notes, pl.variety
     FROM harvests h
     JOIN plantings pl ON pl.id = h.planting_id
     JOIN beds b ON b.id = pl.bed_id
     WHERE b.plan_id = $1
     ORDER BY h.harvested_on`,
    [planId]
  )
  const tasks = await query(
    `SELECT title, due_on, category, completed, description, recurring_pattern
     FROM tasks
     WHERE plan_id = $1
     ORDER BY due_on ASC, created_at ASC`,
    [planId]
  )
  const journal = await query(
    `SELECT title, content, created_at, images
     FROM journal_entries
     WHERE plan_id = $1
     ORDER BY created_at ASC`,
    [planId]
  )

  const bedsWithPlants = beds.map((bed) => ({
    ...bed,
    plantings: plantings.filter((planting) => planting.bed_id === bed.id),
  }))

  const site = {
    id: plan.site_id,
    user_id: plan.user_id,
    name: plan.site_name,
    lat: plan.lat,
    lng: plan.lng,
    country_code: plan.country_code,
    usda_zone: plan.usda_zone,
    last_frost: plan.last_frost,
    first_frost: plan.first_frost,
    surface_type: plan.surface_type,
    slope_pct: plan.slope_pct,
    shade_notes: plan.shade_notes,
    water_source: plan.water_source,
    constraints_json: plan.constraints_json,
  }

  const meta = plan.meta || {}
  return {
    id: plan.id,
    site_id: plan.site_id,
    name: plan.name,
    version: plan.version,
    status: plan.status,
    scene_json: plan.scene_json,
    meta,
    canvas_metadata: (meta as { canvas?: unknown }).canvas || plan.constraints_json?.canvas || {},
    created_at: plan.created_at,
    updated_at: plan.updated_at,
    site,
    sites: site,
    beds: bedsWithPlants,
    materials_estimates: materials,
    harvests,
    tasks,
    journal,
  }
}

export async function syncPlanBeds(
  userId: string,
  planId: string,
  beds: CanvasBedInput[],
  metadata?: Record<string, unknown>,
  planName?: string
) {
  return updateGarden(userId, planId, beds, metadata, planName)
}
