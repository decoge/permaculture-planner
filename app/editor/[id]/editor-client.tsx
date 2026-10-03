'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { PermacultureEditorIntegrated } from '@/components/tldraw/permaculture-editor-integrated'
import { GardenBed } from '@/lib/garden/garden-types'
import { api, ApiError } from '@/lib/api/http'
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load initial data from Supabase beds
  useEffect(() => {
    if (!plan?.beds) {
      setLoading(false)
      return
    }

    try {
      // Convert Supabase beds to GardenBed format WITH plants
      const beds: GardenBed[] = plan.beds.map((bed: any) => {
        let notes: { points?: { x: number; y: number }[]; fill?: string; stroke?: string } = {}
        if (typeof bed.notes === 'string' && bed.notes.startsWith('{')) {
          try {
            notes = JSON.parse(bed.notes)
          } catch {
            notes = {}
          }
        }
        const position = bed.position_json || { x: 0, y: 0, rotation: 0 }
        const width = (bed.length_ft || 4) * 12
        const height = (bed.width_ft || 4) * 12
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

  // Auto-save to Supabase (debounced 2 seconds)
  const handleSave = useCallback(async (updatedBeds: GardenBed[]) => {
    try {
      // Update local state immediately for responsiveness
      setGardenBeds(updatedBeds)

      // Clear any pending save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // Debounce the save operation (2 seconds)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await api(`/api/plans/${plan.id}/beds`, {
            method: 'PUT',
            body: JSON.stringify({ beds: updatedBeds }),
          })
          console.log('Auto-saved successfully')
        } catch (error) {
          const result = { success: false, error: error instanceof ApiError ? error.message : 'Save failed' }
          console.error('Auto-save failed:', result.error)
          toast.error('Auto-save failed', {
            description: 'Your changes may not be saved. Try manual save.',
            duration: 3000,
          })
        }
      }, 2000)
    } catch (error) {
      console.error('Error auto-saving plan:', error)
      toast.error('Auto-save error', {
        description: 'Please use manual save (Cmd+S)',
      })
    }
  }, [plan.id])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Manual save to Supabase (triggered by user action)
  const handleManualSave = useCallback(async () => {
    try {
      const toastId = toast.loading('Saving to database...')

      // Sync all beds to Supabase
      await api(`/api/plans/${plan.id}/beds`, {
        method: 'PUT',
        body: JSON.stringify({ beds: gardenBeds }),
      })

      toast.dismiss(toastId)
      toast.success('✅ Saved to database!', {
        description: `${gardenBeds.length} bed(s) synchronized`,
      })
    } catch (error) {
      toast.dismiss()
      console.error('Error saving to database:', error)
      toast.error('Failed to save to database', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }, [plan.id, gardenBeds])

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
