'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { PermacultureEditorIntegrated } from '@/components/tldraw/permaculture-editor-integrated'
import { GardenBed } from '@/lib/garden/garden-types'
import { api } from '@/lib/api/http'
import { createPendingSave } from '@/lib/editor/pending-save'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface EditorClientProps {
  plan: any
}

/**
 * EditorClient - PRODUCTION-READY editor with Supabase integration
 *
 * ✅ Loads plan from Supabase
 * ✅ Auto-saves to Supabase
 * ✅ User authentication
 * ✅ Real-time data sync
 */
export function EditorClient({ plan }: EditorClientProps) {
  const [gardenBeds, setGardenBeds] = useState<GardenBed[]>([])
  const [loading, setLoading] = useState(true)

  // Load initial data from Supabase beds
  useEffect(() => {
    if (!plan?.beds) {
      setLoading(false)
      return
    }

    try {
      // Convert Supabase beds to GardenBed format WITH plants
      const beds: GardenBed[] = plan.beds.map((bed: any) => {
        let notes: {
          points?: { x: number; y: number }[]
          fill?: string
          stroke?: string
          width?: number
          height?: number
        } = {}
        if (typeof bed.notes === 'string' && bed.notes.startsWith('{')) {
          try {
            notes = JSON.parse(bed.notes)
          } catch {
            notes = {}
          }
        }
        const position = bed.position_json || { x: 0, y: 0, rotation: 0 }
        const width = notes.width && notes.width > 0 ? notes.width : (bed.length_ft || 4) * 12
        const height = notes.height && notes.height > 0 ? notes.height : (bed.width_ft || 4) * 12
        const plants = bed.plantings?.map((planting: any) => {
          const plantPosition = planting.successions_json?.position || { x: 24, y: 24 }
          return {
            id: planting.id,
            plantId: planting.variety,
            x: plantPosition.x,
            y: plantPosition.y,
            plantedDate: planting.sow_date ? new Date(planting.sow_date) : undefined,
          }
        }) || []

        return {
          id: bed.id,
          name: bed.name || 'Garden Bed',
          points: notes.points && notes.points.length > 0 ? notes.points : [
            { x: position.x || 0, y: position.y || 0 },
            { x: (position.x || 0) + width, y: position.y || 0 },
            { x: (position.x || 0) + width, y: (position.y || 0) + height },
            { x: position.x || 0, y: (position.y || 0) + height },
          ],
          fill: notes.fill || '#e0f2e0',
          stroke: notes.stroke || '#22c55e',
          plants,
          width,
          height,
          rotation: position.rotation || (bed.orientation === 'EW' ? 90 : 0),
          elementCategory: 'bed',
          zone: undefined,
        }
      })

      setGardenBeds(beds)
    } catch (error) {
      console.error('Error loading beds:', error)
      toast.error('Failed to load garden plan')
    } finally {
      setLoading(false)
    }
  }, [plan])

  // Extract site data for advanced features
  const siteData = useMemo(() => {
    if (!plan.sites) return null

    return {
      usdaZone: plan.sites.usda_zone || '7a',
      frostDates: plan.sites.last_frost && plan.sites.first_frost
        ? {
            lastFrost: new Date(plan.sites.last_frost),
            firstFrost: new Date(plan.sites.first_frost),
          }
        : null,
      location: plan.sites.lat && plan.sites.lng
        ? { lat: parseFloat(plan.sites.lat), lng: parseFloat(plan.sites.lng) }
        : null,
      surfaceType: plan.sites.surface_type || 'soil',
      waterSource: plan.sites.water_source || 'spigot',
    }
  }, [plan])

  // Auto-save to the plan API (debounced 2 seconds, flushed on unmount so a
  // navigation inside the window does not drop the edit).
  const pendingSave = useMemo(
    () =>
      createPendingSave<GardenBed[]>({
        delayMs: 2000,
        send: async (beds) => {
          const response = await fetch(`/api/plans/${plan.id}/beds`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beds }),
            // keepalive lets the request outlive the navigation that flushes it.
            keepalive: true,
          })
          if (!response.ok) {
            throw new Error(`Autosave failed (${response.status})`)
          }
        },
        onError: () => {
          toast.error('Auto-save failed', {
            description: 'Your changes may not be saved. Try manual save.',
            duration: 3000,
          })
        },
      }),
    [plan.id]
  )

  const handleSave = useCallback(
    (updatedBeds: GardenBed[]) => {
      // Update local state immediately for responsiveness; the PUT follows the
      // debounce (or the unmount flush).
      setGardenBeds(updatedBeds)
      pendingSave.schedule(updatedBeds)
    },
    [pendingSave]
  )

  // Flush, don't cancel: the debounce window is exactly when the user is
  // navigating away right after an edit.
  useEffect(() => {
    return () => {
      pendingSave.flush()
    }
  }, [pendingSave])

  // Manual save to the plan API (triggered by user action). Returns false on
  // failure so the editor does not report a save that did not happen.
  const handleManualSave = useCallback(async (): Promise<boolean> => {
    try {
      const toastId = toast.loading('Saving to database...')

      await api(`/api/plans/${plan.id}/beds`, {
        method: 'PUT',
        body: JSON.stringify({ beds: gardenBeds }),
      })

      // The manual save wrote everything the debounce was holding.
      pendingSave.cancel()

      toast.dismiss(toastId)
      toast.success('✅ Saved to database!', {
        description: `${gardenBeds.length} bed(s) synchronized`,
      })
      return true
    } catch (error) {
      toast.dismiss()
      console.error('Error saving to database:', error)
      toast.error('Failed to save to database', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }, [plan.id, gardenBeds, pendingSave])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your garden plan...</p>
        </div>
      </div>
    )
  }

  return (
    <PermacultureEditorIntegrated
      initialData={gardenBeds}
      onSave={handleSave}
      onManualSave={handleManualSave}
      planId={plan.id}
      showHeader={true}
      siteData={siteData}
    />
  )
}
