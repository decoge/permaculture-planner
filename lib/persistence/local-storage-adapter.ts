import { GardenBed } from '@/lib/garden/garden-types'
import {
  IPersistenceAdapter,
  SaveResult,
  LoadResult,
  DeleteResult,
  CanvasMetadata,
  GardenPlanData,
} from './types'

/**
 * LocalStorage persistence adapter
 *
 * Saves garden plans to browser localStorage with:
 * - Auto-save debouncing (3 seconds)
 * - Quota management
 * - Data validation
 * - Metadata tracking
 */
export class LocalStoragePersistence implements IPersistenceAdapter {
  private readonly STORAGE_KEY = 'permaculture_demo_plan'
  private readonly METADATA_KEY = 'permaculture_demo_metadata'
  private debounceTimer: NodeJS.Timeout | null = null
  private isDirty = false
  private lastSaved: Date | null = null

  /**
   * Save garden plan to localStorage
   */
  async save(
    data: GardenBed[],
    metadata: CanvasMetadata = {},
    planName?: string
  ): Promise<SaveResult> {
    try {
      // Validate data
      if (!Array.isArray(data)) {
        return { success: false, error: 'Invalid data: beds must be an array' }
      }

      // Prepare payload
      const payload: GardenPlanData = {
        beds: data,
        metadata: {
          ...metadata,
          lastModified: new Date().toISOString(),
          version: '1.0',
        },
        planName: planName || 'Demo Garden',
      }

      // Serialise both values before writing either. localStorage has no
      // transaction, so writing the beds first and then the metadata could
      // leave the plan half-saved if the second write hit the quota: beds on
      // disk, metadata describing a different, older save.
      const bedsJson = JSON.stringify(payload.beds)
      const metadataJson = JSON.stringify({
        planName: payload.planName,
        lastSaved: new Date().toISOString(),
        ...payload.metadata,
      })

      // Measure what is actually written, not the wrapping payload object --
      // the two differ, so the old check compared the wrong number against the
      // limit and could reject a plan that fit comfortably.
      const dataSize = bedsJson.length + metadataJson.length
      if (dataSize > 4.5 * 1024 * 1024) {
        // 4.5MB limit (localStorage is typically 5-10MB)
        return {
          success: false,
          error: 'Garden plan is too large for browser storage (>4.5MB)',
        }
      }

      localStorage.setItem(this.STORAGE_KEY, bedsJson)
      localStorage.setItem(this.METADATA_KEY, metadataJson)

      this.lastSaved = new Date()
      this.isDirty = false

      return { success: true }
    } catch (error) {
      // Handle quota exceeded or other localStorage errors
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        return {
          success: false,
          error: 'Browser storage is full. Try clearing old data or exporting to JSON.',
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save to localStorage',
      }
    }
  }

  /**
   * Load garden plan from localStorage
   */
  async load(): Promise<LoadResult> {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY)
      const savedMetadata = localStorage.getItem(this.METADATA_KEY)

      if (!savedData) {
        return {
          success: false,
          error: 'No saved data found in browser storage',
        }
      }

      // Parse and validate
      const beds: GardenBed[] = JSON.parse(savedData)
      const metadata: CanvasMetadata = savedMetadata ? JSON.parse(savedMetadata) : {}

      if (!Array.isArray(beds)) {
        return {
          success: false,
          error: 'Invalid data format in storage',
        }
      }

      this.isDirty = false
      if (metadata.lastModified) {
        this.lastSaved = new Date(metadata.lastModified)
      }

      // The plan name is stored in the metadata on save; returning the literal
      // 'Demo Garden' instead threw it away, so a saved plan always came back
      // under the default name.
      const planName =
        typeof (metadata as { planName?: unknown }).planName === 'string'
          ? (metadata as { planName: string }).planName
          : undefined

      return {
        success: true,
        data: beds,
        metadata,
        planName,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load from localStorage',
      }
    }
  }

  /**
   * Delete garden plan from localStorage
   */
  async delete(): Promise<DeleteResult> {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      localStorage.removeItem(this.METADATA_KEY)
      this.isDirty = false
      this.lastSaved = null

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete from localStorage',
      }
    }
  }

  /**
   * Auto-save with 3 second debouncing
   */
  autoSave(data: GardenBed[], metadata?: CanvasMetadata, planName?: string): void {
    this.isDirty = true

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Set new timer for 3 seconds
    this.debounceTimer = setTimeout(() => {
      this.save(data, metadata, planName).catch((error) => {
        console.error('Auto-save failed:', error)
      })
    }, 3000)
  }

  /**
   * Check if there are unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.isDirty
  }

  /**
   * Mark current state as saved
   */
  markAsSaved(): void {
    this.isDirty = false
    this.lastSaved = new Date()
  }

  /**
   * Get the last save timestamp
   */
  getLastSaved(): Date | null {
    return this.lastSaved
  }

  /**
   * Export garden plan as JSON file
   */
  exportJSON(data: GardenBed[], planName: string = 'garden-plan'): void {
    const payload: GardenPlanData = {
      beds: data,
      metadata: {
        lastModified: new Date().toISOString(),
        version: '1.0',
      },
      planName,
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${planName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Import garden plan from JSON file
   */
  async importJSON(file: File): Promise<LoadResult> {
    try {
      const text = await file.text()
      const payload: GardenPlanData = JSON.parse(text)

      // Validate structure
      if (!payload.beds || !Array.isArray(payload.beds)) {
        return {
          success: false,
          error: 'Invalid JSON format: missing beds array',
        }
      }

      // Save imported data
      await this.save(payload.beds, payload.metadata, payload.planName)

      return {
        success: true,
        data: payload.beds,
        metadata: payload.metadata,
        planName: payload.planName,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import JSON file',
      }
    }
  }
}
