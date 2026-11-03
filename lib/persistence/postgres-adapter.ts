import { GardenBed } from '@/lib/garden/garden-types'
import { api, ApiError } from '@/lib/api/http'
import {
  IPersistenceAdapter,
  SaveResult,
  LoadResult,
  DeleteResult,
  CanvasMetadata,
} from './types'

interface StoredBed {
  id: string
  name?: string
  length_ft?: number
  width_ft?: number
  position_json?: { x?: number; y?: number; rotation?: number }
  notes?: string
  plantings?: Array<{
    id: string
    variety?: string | null
    successions_json?: { position?: { x?: number; y?: number } }
  }>
}

/**
 * Postgres persistence adapter.
 * Saves through the app's plan API, which writes to DATABASE_URL.
 */
export class PostgresPersistence implements IPersistenceAdapter {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private isDirty = false
  private lastSaved: Date | null = null
  /** Tail of the save queue; every save runs after the one before it. */
  private queue: Promise<unknown> = Promise.resolve()
  /** Saves queued or running, including this one. */
  private queued = 0
  /** Payload waiting out the autosave debounce. */
  private pending: { data: GardenBed[]; metadata?: CanvasMetadata; planName?: string } | null = null
  /** Callers waiting for the debounced write, so they can clear their own dirty flag. */
  private pendingResolvers: Array<(result: SaveResult) => void> = []

  constructor(private planId: string) {}

  /**
   * Save serially rather than refusing while another request is in flight.
   *
   * The debounced autosave can fire while a slow request is still running. The
   * old early return answered `Save already in progress` and dropped that
   * snapshot on the floor, and nothing rescheduled it, so the canvas reported
   * "All changes saved" with the newest edits only in memory.
   */
  async save(data: GardenBed[], metadata?: CanvasMetadata, planName?: string): Promise<SaveResult> {
    if (!Array.isArray(data)) return { success: false, error: 'Invalid data: beds must be an array' }

    this.queued += 1
    const run = this.queue
      .then(() => this.send(data, metadata, planName))
      .finally(() => {
        this.queued -= 1
      })
    // One failed save must not wedge every later one, so the chain continues on
    // the settled value while the caller still sees the rejection.
    this.queue = run.catch(() => undefined)
    return run
  }

  private async send(data: GardenBed[], metadata?: CanvasMetadata, planName?: string): Promise<SaveResult> {
    try {
      await api(`/api/plans/${this.planId}/beds`, {
        method: 'PUT',
        body: JSON.stringify({ beds: data, metadata, planName }),
      })
      this.lastSaved = new Date()
      // Only claim the canvas clean when nothing else is waiting behind this
      // save; a newer edit still has to go out.
      if (this.queued <= 1) this.isDirty = false
      return { success: true, planId: this.planId }
    } catch (error) {
      return { success: false, error: error instanceof ApiError ? error.message : 'Failed to save plan' }
    }
  }

  async load(id?: string): Promise<LoadResult> {
    const loadId = id || this.planId
    try {
      const plan = await api<{
        name?: string
        updated_at?: string
        canvas_metadata?: CanvasMetadata
        beds?: StoredBed[]
      }>(`/api/plans/${loadId}`)

      const beds = (plan.beds || []).map((bed) => this.toGardenBed(bed))
      this.isDirty = false
      this.lastSaved = plan.updated_at ? new Date(plan.updated_at) : null
      return {
        success: true,
        data: beds,
        metadata: plan.canvas_metadata || {},
        planName: plan.name,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof ApiError ? error.message : 'Failed to load plan',
      }
    }
  }

  async delete(id?: string): Promise<DeleteResult> {
    const deleteId = id || this.planId
    try {
      await api(`/api/plans/${deleteId}`, { method: 'DELETE' })
      this.isDirty = false
      this.lastSaved = null
      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof ApiError ? error.message : 'Failed to delete plan' }
    }
  }

  autoSave(data: GardenBed[], metadata?: CanvasMetadata, planName?: string): Promise<SaveResult> {
    this.isDirty = true
    this.pending = { data, metadata, planName }
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.flushPending()
    }, 2000)

    return new Promise<SaveResult>((resolve) => {
      this.pendingResolvers.push(resolve)
    })
  }

  /**
   * Send the payload still waiting in the debounce window.
   *
   * The demo page unmounts when the user navigates, which used to discard the
   * timer and the edit with it.
   */
  flushPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    const payload = this.pending
    this.pending = null
    if (!payload) {
      this.settlePending({ success: false, error: 'Nothing to save' })
      return
    }
    this.save(payload.data, payload.metadata, payload.planName)
      .then((result) => this.settlePending(result))
      .catch((error) => {
        console.error('Auto-save failed:', error)
        this.settlePending({
          success: false,
          error: error instanceof Error ? error.message : 'Auto-save failed',
        })
      })
  }

  /** Resolve every caller waiting on the debounced write. */
  private settlePending(result: SaveResult) {
    const resolvers = this.pendingResolvers
    this.pendingResolvers = []
    for (const resolve of resolvers) resolve(result)
  }

  hasUnsavedChanges(): boolean {
    return this.isDirty
  }

  markAsSaved(): void {
    this.isDirty = false
    this.lastSaved = new Date()
  }

  getLastSaved(): Date | null {
    return this.lastSaved
  }

  private toGardenBed(bed: StoredBed): GardenBed {
    let notes: {
      points?: { x: number; y: number }[]
      fill?: string
      stroke?: string
      width?: number
      height?: number
    } = {}
    if (bed.notes && bed.notes.startsWith('{')) {
      try {
        notes = JSON.parse(bed.notes)
      } catch {
        notes = {}
      }
    }
    const position = bed.position_json || { x: 0, y: 0, rotation: 0 }
    const width = notes.width && notes.width > 0 ? notes.width : (bed.length_ft || 4) * 12
    const height = notes.height && notes.height > 0 ? notes.height : (bed.width_ft || 4) * 12
    const points = notes.points && notes.points.length > 0
      ? notes.points
      : [
          { x: position.x || 0, y: position.y || 0 },
          { x: (position.x || 0) + width, y: position.y || 0 },
          { x: (position.x || 0) + width, y: (position.y || 0) + height },
          { x: position.x || 0, y: (position.y || 0) + height },
        ]

    return {
      id: bed.id,
      name: bed.name || 'Garden Bed',
      points,
      fill: notes.fill || '#e0f2e0',
      stroke: notes.stroke || '#22c55e',
      rotation: position.rotation || 0,
      width,
      height,
      plants: (bed.plantings || []).map((planting) => ({
        id: planting.id,
        plantId: planting.variety || 'unknown',
        x: planting.successions_json?.position?.x ?? 24,
        y: planting.successions_json?.position?.y ?? 24,
      })),
    }
  }
}
