'use client'

import { api, ApiError } from '@/lib/api/http'
import { showError, showSuccess, showLoading, showWarning } from '@/components/ui/action-feedback'
import {
  GardenBed,
  SaveGardenResult,
  LoadGardenResult,
  GardenListItem,
  GardenData,
  CanvasMetadata,
  SiteInsert,
  PlanInsert,
} from './garden-types'

function message(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Please sign in to continue'
    return error.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}

export class GardenService {
  async saveGarden(
    beds: GardenBed[],
    metadata: CanvasMetadata,
    siteData?: Partial<SiteInsert>,
    planData?: Partial<PlanInsert>
  ): Promise<SaveGardenResult> {
    showLoading('Saving garden design...')
    try {
      const result = await api<SaveGardenResult>('/api/gardens', {
        method: 'POST',
        body: JSON.stringify({ beds, metadata, siteData, planData }),
      })
      showSuccess('Garden saved successfully!')
      return result
    } catch (error) {
      const errorMessage = message(error, 'Failed to save garden')
      showError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async loadGarden(planId: string): Promise<LoadGardenResult> {
    showLoading('Loading garden design...')
    try {
      const { plan } = await api<{ plan: Record<string, unknown> }>(`/api/gardens/${planId}`)
      const site = (plan.site || {}) as Record<string, unknown>
      const beds = (plan.beds || []) as Array<Record<string, unknown>>
      const plantings = beds.flatMap((bed) => (bed.plantings as Array<Record<string, unknown>>) || [])
      const canvasBeds = beds.map((bed) => bedFromRow(bed, plantings))
      const constraints = (site.constraints_json || {}) as { canvas?: CanvasMetadata }
      const garden: GardenData = {
        site: {
          id: String(site.id),
          name: String(site.name || 'Garden'),
          lat: site.lat as number | undefined,
          lng: site.lng as number | undefined,
          country_code: (site.country_code as string | undefined) || undefined,
          usda_zone: (site.usda_zone as string | undefined) || undefined,
          last_frost: (site.last_frost as string | undefined) || undefined,
          first_frost: (site.first_frost as string | undefined) || undefined,
          surface_type: (site.surface_type as 'soil' | 'hard') || 'soil',
          slope_pct: site.slope_pct as number | undefined,
          shade_notes: (site.shade_notes as string | undefined) || undefined,
          water_source: (site.water_source as 'spigot' | 'none' | 'rain') || 'spigot',
          constraints_json: (site.constraints_json as Record<string, unknown>) || undefined,
        },
        plan: {
          id: String(plan.id),
          site_id: String(plan.site_id),
          name: String(plan.name),
          version: Number(plan.version) || 1,
          status: (plan.status as 'draft' | 'active' | 'archived') || 'draft',
        },
        beds: canvasBeds,
        canvas: constraints.canvas || {
          zoom: 100,
          viewBox: { x: 0, y: 0, width: 800, height: 600 },
          showGrid: true,
          showLabels: true,
          showSpacing: false,
          showSunRequirements: false,
          showWaterRequirements: false,
        },
      }
      showSuccess('Garden loaded successfully!')
      return { success: true, garden }
    } catch (error) {
      const errorMessage = message(error, 'Failed to load garden')
      showError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async updateGarden(planId: string, beds: GardenBed[], metadata: CanvasMetadata): Promise<SaveGardenResult> {
    showLoading('Updating garden...')
    try {
      const result = await api<SaveGardenResult>(`/api/gardens/${planId}`, {
        method: 'PUT',
        body: JSON.stringify({ beds, metadata }),
      })
      showSuccess('Garden updated successfully!')
      return result
    } catch (error) {
      const errorMessage = message(error, 'Failed to update garden')
      showError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async deleteGarden(planId: string): Promise<{ success: boolean; error?: string }> {
    showLoading('Deleting garden...')
    try {
      await api(`/api/gardens/${planId}`, { method: 'DELETE' })
      showSuccess('Garden deleted successfully')
      return { success: true }
    } catch (error) {
      const errorMessage = message(error, 'Failed to delete garden')
      showError(errorMessage)
      return { success: false, error: errorMessage }
    }
  }

  async listUserGardens(): Promise<GardenListItem[]> {
    try {
      const data = await api<{ gardens: GardenListItem[] }>('/api/gardens')
      return data.gardens || []
    } catch (error) {
      console.error('Error in listUserGardens:', error)
      return []
    }
  }

  async quickSave(beds: GardenBed[], metadata: CanvasMetadata, existingPlanId?: string): Promise<SaveGardenResult> {
    if (existingPlanId) return this.updateGarden(existingPlanId, beds, metadata)
    return this.saveGarden(beds, metadata)
  }

  async autoSave(
    beds: GardenBed[],
    metadata: CanvasMetadata,
    planId?: string,
    lastSaveTimestamp?: number
  ): Promise<SaveGardenResult> {
    try {
      if (planId && lastSaveTimestamp) {
        const plan = await api<{ updated_at?: string }>(`/api/plans/${planId}`)
        if (plan.updated_at && new Date(plan.updated_at).getTime() > lastSaveTimestamp) {
          showWarning('Newer version detected. Auto-save skipped to prevent conflicts.')
          return { success: false, error: 'Conflict detected' }
        }
      }
      return this.quickSave(beds, metadata, planId)
    } catch (error) {
      console.error('Auto-save failed:', error)
      return { success: false, error: message(error, 'Auto-save failed') }
    }
  }
}

function bedFromRow(bed: Record<string, unknown>, plantings: Array<Record<string, unknown>>): GardenBed {
  let notes: Record<string, unknown> = {}
  if (typeof bed.notes === 'string' && bed.notes.startsWith('{')) {
    try {
      notes = JSON.parse(bed.notes) as Record<string, unknown>
    } catch {
      notes = {}
    }
  }
  const position = (bed.position_json || {}) as { x?: number; y?: number; rotation?: number }
  const length = Number(bed.length_ft) || 4
  const width = Number(bed.width_ft) || 4
  const points = Array.isArray(notes.points)
    ? (notes.points as { x: number; y: number }[])
    : [
        { x: position.x || 0, y: position.y || 0 },
        { x: (position.x || 0) + length * 12, y: position.y || 0 },
        { x: (position.x || 0) + length * 12, y: (position.y || 0) + width * 12 },
        { x: position.x || 0, y: (position.y || 0) + width * 12 },
      ]

  return {
    id: String(bed.id),
    name: String(bed.name || 'Garden Bed'),
    points,
    fill: String(notes.fill || '#e0f2e0'),
    stroke: String(notes.stroke || '#22c55e'),
    plants: plantings
      .filter((planting) => planting.bed_id === bed.id)
      .map((planting) => {
        const stored = (planting.successions_json || {}) as { position?: { x?: number; y?: number } }
        return {
          id: String(planting.id),
          plantId: String(planting.variety || planting.crop_id || 'unknown'),
          x: stored.position?.x ?? 24,
          y: stored.position?.y ?? 24,
          plantedDate: planting.sow_date ? new Date(String(planting.sow_date)) : undefined,
        }
      }),
    width: typeof notes.width === 'number' ? notes.width : length * 12,
    height: typeof notes.height === 'number' ? notes.height : width * 12,
    rotation: position.rotation || 0,
    elementType: notes.elementType as string | undefined,
    elementCategory: notes.elementCategory as GardenBed['elementCategory'],
    zone: notes.zone as GardenBed['zone'],
    metadata: notes.metadata as Record<string, unknown> | undefined,
  }
}

export const gardenService = new GardenService()
